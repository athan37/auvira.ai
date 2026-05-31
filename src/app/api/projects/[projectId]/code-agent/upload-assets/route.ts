import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getProjectActorUserId } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { resolveWorkspaceForEdit } from '@/lib/project-workspace/resolveWorkspaceGateway';
import {
  LEGACY_PROJECT_UNSUPPORTED_MESSAGE,
  projectSupportsV3Edits,
} from '@/lib/project-workspace/requireGitLabProject';
import { isSandboxPreviewEnabled } from '@/lib/runtime/isSandboxPreviewEnabled';
import { ensureGitWorkspace } from '@/lib/project-workspace/gitWorkspaceManager';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGES_PER_UPLOAD,
} from '@/lib/project-workspace/workspaceAssetTypes';
import {
  buildAssetPreviewUrl,
  getWorkspaceUploadDir,
  saveWorkspaceImages,
} from '@/lib/project-workspace/workspaceAssets';
import { getProjectSandbox } from '@/lib/sandbox/sandboxClient';
import { writeSandboxFile } from '@/lib/sandbox/sandboxFsWrite';
import { SANDBOX_WORKDIR } from '@/lib/sandbox/types';
import crypto from 'crypto';
import path from 'path';

export const runtime = 'nodejs';

async function resolveGitLabWorkspace(
  project: NonNullable<Awaited<ReturnType<typeof getOwnerProject>>>,
  userId: string
): Promise<{ workspacePath: string; sandbox: boolean }> {
  if (isSandboxPreviewEnabled()) {
    const resolved = await resolveWorkspaceForEdit(project, userId);
    return {
      workspacePath: resolved.workspacePath,
      sandbox: resolved.sandbox,
    };
  }
  const gitInfo = await ensureGitWorkspace(project, userId);
  return { workspacePath: gitInfo.workspacePath, sandbox: false };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, error: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (!projectSupportsV3Edits(project)) {
    return NextResponse.json(
      { ok: false, error: LEGACY_PROJECT_UNSUPPORTED_MESSAGE },
      { status: 409 }
    );
  }

  const userId = await getProjectActorUserId(project);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const entries = formData.getAll('files').filter((v): v is File => v instanceof File);

  if (entries.length === 0) {
    return NextResponse.json({ ok: false, error: 'Select at least one image.' }, { status: 400 });
  }
  if (entries.length > MAX_IMAGES_PER_UPLOAD) {
    return NextResponse.json(
      { ok: false, error: `You can upload up to ${MAX_IMAGES_PER_UPLOAD} images at a time.` },
      { status: 400 }
    );
  }

  const files: Array<{ name: string; mimeType: string; buffer: Buffer }> = [];
  for (const file of entries) {
    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      return NextResponse.json(
        { ok: false, error: `Unsupported file type: ${file.name}` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    files.push({ name: file.name, mimeType, buffer });
  }

  try {
    const { workspacePath, sandbox } = await resolveGitLabWorkspace(project, userId);

    if (sandbox) {
      const sb = await getProjectSandbox(params.projectId);
      const uploadDir = getWorkspaceUploadDir('gitlab');
      await sb.runCommand({
        cmd: 'mkdir',
        args: ['-p', uploadDir],
        cwd: SANDBOX_WORKDIR,
      });
      const attachments = [];
      for (const file of files) {
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const filename = `${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}-${id}${path.extname(file.name) || '.jpg'}`;
        const relativePath = `${uploadDir}/${filename}`;
        await writeSandboxFile(
          sb,
          path.posix.join(SANDBOX_WORKDIR, relativePath),
          file.buffer
        );
        const publicUrl = `/uploads/${filename}`;
        attachments.push({
          id,
          path: relativePath,
          publicUrl,
          previewUrl: buildAssetPreviewUrl(params.projectId, 'gitlab', publicUrl),
          originalName: file.name,
          mimeType: file.mimeType,
          size: file.buffer.length,
        });
      }
      await WebsiteProject.updateOne(
        { _id: project._id },
        { $set: { hasUnpublishedChanges: true, lastPreviewEditedAt: new Date() } }
      );
      return NextResponse.json({ ok: true, attachments });
    }

    const attachments = await saveWorkspaceImages({
      workspacePath,
      mode: 'gitlab',
      projectId: params.projectId,
      files,
    });

    await WebsiteProject.updateOne(
      { _id: project._id },
      {
        $set: {
          hasUnpublishedChanges: true,
          lastPreviewEditedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true, attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
