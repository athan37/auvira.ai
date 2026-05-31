/**
 * Purge WebsiteProject documents that cannot use V3 (GitLab) edits.
 *
 * Targets:
 * - V1/static: no gitlab.repoUrl
 * - V2/wrong: incomplete gitlab record, spec editingMode, or static HTML workspace path
 *
 * IRREVERSIBLE when run with --execute. Default is dry-run (preview only).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/purge-non-gitlab-projects.ts
 *   npx tsx --env-file=.env scripts/purge-non-gitlab-projects.ts --execute
 */
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { ProjectMessage } from '../src/models/ProjectMessage';
import { ProjectEditJob } from '../src/models/ProjectEditJob';
import { ProjectAction } from '../src/models/ProjectAction';
import { WebsiteProjectLog } from '../src/models/WebsiteProjectLog';
import { BusinessProfile } from '../src/models/BusinessProfile';
import { WebsiteAnalyticsConfig } from '../src/models/WebsiteAnalyticsConfig';
import { SiteHealthIncident } from '../src/models/SiteHealthIncident';
import { OwnerMonitor } from '../src/models/OwnerMonitor';
import { Product } from '../src/models/Product';
import { SiteFixProposal } from '../src/models/SiteFixProposal';
import { AnalyticsEventBatch } from '../src/models/AnalyticsEventBatch';
import { ComponentAnalyticsTotal } from '../src/models/ComponentAnalyticsTotal';
import { ComponentAnalyticsWeekly } from '../src/models/ComponentAnalyticsWeekly';
import { CloneJob } from '../src/lib/db/models/CloneJob';
import {
  getUnsupportedProjectReason,
  unsupportedProjectReasonLabel,
  type UnsupportedProjectReason,
} from '../src/lib/project-workspace/requireGitLabProject';

const execute = process.argv.includes('--execute');

type DeleteCounts = Record<string, number>;

async function deleteRelated(projectIds: mongoose.Types.ObjectId[]): Promise<DeleteCounts> {
  const filter = { projectId: { $in: projectIds } };
  const counts: DeleteCounts = {};

  const ops: Array<[string, () => Promise<{ deletedCount?: number }>]> = [
    ['ProjectMessage', () => ProjectMessage.deleteMany(filter)],
    ['ProjectEditJob', () => ProjectEditJob.deleteMany(filter)],
    ['ProjectAction', () => ProjectAction.deleteMany(filter)],
    ['WebsiteProjectLog', () => WebsiteProjectLog.deleteMany(filter)],
    ['BusinessProfile', () => BusinessProfile.deleteMany(filter)],
    ['WebsiteAnalyticsConfig', () => WebsiteAnalyticsConfig.deleteMany(filter)],
    ['SiteHealthIncident', () => SiteHealthIncident.deleteMany(filter)],
    ['OwnerMonitor', () => OwnerMonitor.deleteMany(filter)],
    ['Product', () => Product.deleteMany(filter)],
    ['SiteFixProposal', () => SiteFixProposal.deleteMany(filter)],
    ['AnalyticsEventBatch', () => AnalyticsEventBatch.deleteMany(filter)],
    ['ComponentAnalyticsTotal', () => ComponentAnalyticsTotal.deleteMany(filter)],
    ['ComponentAnalyticsWeekly', () => ComponentAnalyticsWeekly.deleteMany(filter)],
    [
      'CloneJob',
      () => CloneJob.deleteMany({ createdProjectId: { $in: projectIds } }),
    ],
  ];

  for (const [name, run] of ops) {
    const result = await run();
    counts[name] = result.deletedCount ?? 0;
  }

  const projectResult = await WebsiteProject.deleteMany({ _id: { $in: projectIds } });
  counts.WebsiteProject = projectResult.deletedCount ?? 0;

  return counts;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required (use: npx tsx --env-file=.env ...)');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const all = await WebsiteProject.find({})
    .select(
      '_id name mode status gitlab editingMode codeWorkspace.source codeWorkspace.workspacePath createdAt'
    )
    .lean();

  const unsupported: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    mode: string;
    reason: UnsupportedProjectReason;
    source?: string;
    workspacePath?: string;
  }> = [];

  for (const p of all) {
    const reason = getUnsupportedProjectReason(p);
    if (!reason) continue;
    unsupported.push({
      _id: p._id as mongoose.Types.ObjectId,
      name: p.name,
      mode: p.mode,
      reason,
      source: p.codeWorkspace?.source,
      workspacePath: p.codeWorkspace?.workspacePath,
    });
  }

  const byReason = unsupported.reduce(
    (acc, row) => {
      acc[row.reason] = (acc[row.reason] ?? 0) + 1;
      return acc;
    },
    {} as Record<UnsupportedProjectReason, number>
  );

  console.log(`\nUnsupported projects (V1 static + V2/wrong): ${unsupported.length} / ${all.length}`);
  for (const [reason, count] of Object.entries(byReason)) {
    console.log(`  ${unsupportedProjectReasonLabel(reason as UnsupportedProjectReason)}: ${count}`);
  }

  for (const p of unsupported) {
    const extras: string[] = [`mode=${p.mode}`, `reason=${unsupportedProjectReasonLabel(p.reason)}`];
    if (p.source) extras.push(`source=${p.source}`);
    if (p.workspacePath) extras.push(`workspace=${p.workspacePath}`);
    console.log(`  - ${String(p._id)} | ${p.name} | ${extras.join(' | ')}`);
  }

  if (unsupported.length === 0) {
    console.log('\nNothing to purge.');
    await mongoose.disconnect();
    return;
  }

  if (!execute) {
    console.log('\nDry-run only. Re-run with --execute to delete permanently.');
    await mongoose.disconnect();
    return;
  }

  const ids = unsupported.map((p) => p._id);
  const counts = await deleteRelated(ids);

  console.log('\nDeleted:');
  for (const [collection, count] of Object.entries(counts)) {
    console.log(`  ${collection}: ${count}`);
  }

  await mongoose.disconnect();
  console.log('\nPurge complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
