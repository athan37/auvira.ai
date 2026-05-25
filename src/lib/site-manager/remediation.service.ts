import mongoose from 'mongoose';
import { ProjectAction } from '@/models/ProjectAction';
import { WebsiteProject, type IWebsiteProject } from '@/models/WebsiteProject';
import { applyDeterministicPatch } from './patchers';
import { approveFixProposal, getFixProposal } from './fixProposal.service';
import { getIncident, markIncidentFailed, markIncidentResolved } from './incidents.service';
import { rerunMonitorCheck } from './watchRunner.service';
import { MAX_FIX_ATTEMPTS } from './types';
import { saveWorkspaceToGitLab } from '@/lib/project-workspace/commitWorkspaceToGitLab';
import { ensureGitWorkspace, getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import { validateWorkspace } from '@/lib/project-workspace/validateWorkspace';
import { ensureVercelProjectLinked } from '@/lib/vercel/ensureVercelProject';
import { triggerVercelDeployment } from '@/lib/vercel/triggerVercelDeployment';
import { checkVercelDeployment } from '@/lib/vercel/checkDeployment';
const POLL_MS = 4000;
const POLL_MAX = 45;

async function waitDeployReady(project: IWebsiteProject, commitSha: string) {
  if (!project.deployment?.projectId) return false;
  for (let i = 0; i < POLL_MAX; i++) {
    const s = await checkVercelDeployment(project.deployment.projectId, project.deployment.vercelProjectName, {
      expectedCommitSha: commitSha,
      deploymentId: project.deployment.activeDeploymentId,
      since: project.deployment.triggeredAt,
    });
    if (s.status === 'ready' && s.commitVerified) return true;
    if (s.status === 'failed') return false;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

export async function executeApprovedFix(projectId: string, incidentId: string, ownerId: string) {
  const incident = await getIncident(projectId, incidentId);
  if (!incident) return { ok: false, incidentId, status: 'failed', message: 'Incident not found' };
  if (['resolved', 'dismissed', 'failed'].includes(incident.status)) {
    return { ok: false, incidentId, status: incident.status, message: 'Incident already closed' };
  }
  if (incident.fixAttempts >= MAX_FIX_ATTEMPTS) {
    await markIncidentFailed(incident);
    return { ok: false, incidentId, status: 'failed', message: 'Maximum fix attempts reached' };
  }

  const proposalId = incident.activeProposalId?.toString();
  if (!proposalId) return { ok: false, incidentId, status: 'failed', message: 'No fix proposal' };

  const proposal = await getFixProposal(projectId, proposalId);
  if (!proposal || proposal.status !== 'pending' || proposal.riskLevel !== 'safe') {
    return { ok: false, incidentId, status: 'failed', message: 'Fix not available for approval' };
  }

  let project = await WebsiteProject.findById(projectId);
  if (!project) return { ok: false, incidentId, status: 'failed', message: 'Project not found' };

  incident.fixAttempts += 1;
  incident.status = 'fix_approved';
  await incident.save();
  await approveFixProposal(proposal);

  try {
    await ensureGitWorkspace(project, ownerId);
    project = await WebsiteProject.findById(projectId);
    if (!project?.gitlab?.projectId) throw new Error('GitLab not linked');

    const workspacePath = getGitWorkspacePath(projectId);
    let changedFiles: string[] = [];
    if (proposal.proposedChange.patchType !== 'redeploy_only') {
      changedFiles = await applyDeterministicPatch(workspacePath, proposal.proposedChange);
      const validation = await validateWorkspace(workspacePath, { changedFiles });
      if (!validation.ok) throw new Error(validation.errors[0] || 'Build validation failed');
    }

    const sync = await saveWorkspaceToGitLab(project, projectId, {
      force: true,
      commitMessage: `Site Manager: ${proposal.title}`,
    });

    const ensured = await ensureVercelProjectLinked(project);
    const deployment = ensured.deployment ?? project.deployment;
    if (!deployment?.projectId) throw new Error('Vercel not linked');

    const redeploy = await triggerVercelDeployment({
      vercelProjectId: deployment.projectId,
      vercelProjectName: deployment.vercelProjectName || project.name,
      gitlabProjectId: project.gitlab.projectId,
      gitlabPathWithNamespace: project.gitlab.pathWithNamespace,
      commitSha: sync.commitSha,
      branch: project.gitlab.defaultBranch || 'main',
    });
    if (!redeploy.deployTriggered) throw new Error(redeploy.error || 'Deploy failed');

    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          hasUnpublishedChanges: false,
          'gitlab.lastCommitSha': sync.commitSha,
          deployment: {
            ...deployment,
            status: 'building',
            triggeredAt: new Date().toISOString(),
            lastDeployedCommitSha: sync.commitSha,
            activeDeploymentId: redeploy.deploymentId || '',
          },
        },
      }
    );

    const refreshed = await WebsiteProject.findById(projectId);
    if (!refreshed) throw new Error('Project not found after deploy');
    await waitDeployReady(refreshed, sync.commitSha);
    await new Promise((r) => setTimeout(r, 3000));

    const recheck = await rerunMonitorCheck(projectId, incident.monitorId.toString());
    if (recheck.passed) {
      proposal.status = 'applied';
      proposal.appliedAt = new Date();
      await proposal.save();
      await markIncidentResolved(incident);
      await ProjectAction.create({
        projectId: new mongoose.Types.ObjectId(projectId),
        ownerId: new mongoose.Types.ObjectId(ownerId),
        type: 'fix_applied',
        status: 'succeeded',
        output: { recheckPassed: true },
        commitSha: sync.commitSha,
        completedAt: new Date(),
      });
      return {
        ok: true,
        incidentId,
        status: 'resolved',
        message: 'Fix applied and verified on your live website.',
        commitSha: sync.commitSha,
        recheckPassed: true,
      };
    }

    if (incident.fixAttempts >= MAX_FIX_ATTEMPTS) await markIncidentFailed(incident);
    else incident.status = 'fix_suggested';
    await incident.save();
    proposal.status = 'failed';
    await proposal.save();

    return {
      ok: false,
      incidentId,
      status: incident.status,
      message: 'Fix published but issue not fully resolved. Try again or fix manually.',
      recheckPassed: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fix failed';
    proposal.status = 'failed';
    await proposal.save();
    if (incident.fixAttempts >= MAX_FIX_ATTEMPTS) await markIncidentFailed(incident);
    else incident.status = 'fix_suggested';
    await incident.save();
    return { ok: false, incidentId, status: 'failed', message };
  }
}
