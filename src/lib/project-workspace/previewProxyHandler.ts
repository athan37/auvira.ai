import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import {
  checkWorkspacePreviewHealthy,
  isReservedWorkspacePreviewPort,
} from '@/lib/preview/workspacePreviewHealth';
import { buildPreviewLoadingHtml } from '@/lib/project-workspace/codePreviewServe';
import { rewritePreviewResponseBody } from '@/lib/project-workspace/previewProxyRewrite';

export { rewriteHtmlAssetPaths } from '@/lib/project-workspace/previewProxyRewrite';

const PRESERVE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'content-encoding',
  'vary',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-expose-headers',
];

const BLOCK_HEADERS = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'x-xss-protection',
  'permissions-policy',
  'transfer-encoding',
  'connection',
];

function shouldBlockHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return BLOCK_HEADERS.some(
    (h) => lower === h || lower.includes('security') || lower.includes('frame')
  );
}

function filterHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const filtered = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (shouldBlockHeader(key)) continue;
    if (!PRESERVE_HEADERS.includes(key.toLowerCase())) continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      filtered.set(key, value.join(', '));
    } else {
      filtered.set(key, value);
    }
  }
  return filtered;
}

function makeProxyRequest(
  targetUrl: string
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    // Request identity encoding so HTML can be rewritten (gzip breaks string injection).
    const req = require('http').get(
      targetUrl,
      { headers: { 'Accept-Encoding': 'identity' } },
      (res: { statusCode?: number; headers: Record<string, string | string[] | undefined>; on: Function }) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 500,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.setTimeout(15000);
  });
}

function friendlyHtml(message: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Unavailable</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f9fafb;
    }
    .card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      max-width: 400px;
    }
    h2 { font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px; }
    p { font-size: 14px; color: #6b7280; margin: 0 0 24px; line-height: 1.5; }
    button {
      background: #4f46e5; color: white; border: none; border-radius: 8px;
      padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Preview Unavailable</h2>
    <p>${message}</p>
    <button onclick="window.location.reload()">Retry</button>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

function resolveProxyPath(pathSegments?: string[]): string {
  if (!pathSegments?.length) return '/';
  return `/${pathSegments.join('/')}`;
}

export async function handlePreviewProxyGet(
  request: NextRequest,
  projectId: string,
  pathSegments?: string[]
): Promise<NextResponse> {
  const cleanPath = resolveProxyPath(pathSegments);
  const url = request.nextUrl;

  const project = await getOwnerProject(projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const pathSegment = cleanPath === '/' ? '/' : cleanPath;
  const previewMode = (project.preview as { previewMode?: string } | undefined)?.previewMode;
  const sandboxPreviewUrl = project.preview?.url?.trim();

  if (previewMode === 'sandbox' && sandboxPreviewUrl) {
    const target = `${sandboxPreviewUrl.replace(/\/$/, '')}${pathSegment}${url.search}`;
    try {
      const res = await fetch(target, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: { 'Accept-Encoding': 'identity' },
      });
      const buffer = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get('content-type') || '';
      const rewrite = rewritePreviewResponseBody(buffer, ct, projectId);

      if (rewrite.rewritten) {
        return new NextResponse(rewrite.body as unknown as BodyInit, {
          status: res.status,
          headers: {
            'content-type': rewrite.contentType,
            'cache-control': 'no-store',
            'x-frame-options': 'SAMEORIGIN',
          },
        });
      }

      const headers = new Headers();
      if (ct) headers.set('content-type', ct);
      headers.set('cache-control', 'no-store');
      headers.set('x-frame-options', 'SAMEORIGIN');
      return new NextResponse(buffer, { status: res.status, headers });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[preview-proxy] sandbox projectId=${projectId} failed error=${errMsg}`);
      return friendlyHtml('Sandbox preview is starting or unavailable. Please retry.');
    }
  }

  const port = project.preview?.port;
  const workspacePath =
    project.preview?.workspacePath?.trim() || getGitWorkspacePath(projectId);
  if (port && project.preview?.status === 'ready') {
    const healthy =
      !isReservedWorkspacePreviewPort(port) &&
      (await checkWorkspacePreviewHealthy(port, workspacePath));
    if (!healthy) {
      return new NextResponse(
        buildPreviewLoadingHtml(
          projectId,
          'Preview server stopped responding. Refresh the page or wait while it restarts.'
        ),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }
  }

  if (!port || project.preview?.status !== 'ready') {
    const isLoading =
      project.codeWorkspace?.status === 'setting_up' ||
      project.preview?.status === 'building' ||
      project.preview?.status === 'starting';
    const label =
      project.codeWorkspace?.setupLabel ||
      (isLoading ? 'Starting preview server…' : 'Preview server is not running.');
    if (isLoading) {
      return new NextResponse(buildPreviewLoadingHtml(projectId, label), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
    return friendlyHtml(label);
  }

  const target = `http://127.0.0.1:${port}${pathSegment}${url.search}`;

  try {
    const result = await makeProxyRequest(target);
    let filteredHeaders = filterHeaders(result.headers);

    const contentType = result.headers['content-type'];
    const ctStr = Array.isArray(contentType) ? contentType[0] : contentType || '';
    const rewrite = rewritePreviewResponseBody(result.body, ctStr, projectId);

    if (rewrite.rewritten) {
      filteredHeaders.delete('content-length');
      filteredHeaders.delete('content-encoding');
      filteredHeaders.delete('etag');
      filteredHeaders.delete('last-modified');
      filteredHeaders.set('content-type', rewrite.contentType);
      filteredHeaders.set('cache-control', 'no-store');
      filteredHeaders.set('x-frame-options', 'SAMEORIGIN');
      filteredHeaders.delete('content-security-policy');
      return new NextResponse(rewrite.body as unknown as BodyInit, {
        status: result.status,
        headers: filteredHeaders,
      });
    }

    filteredHeaders.set('x-frame-options', 'SAMEORIGIN');
    filteredHeaders.delete('content-security-policy');

    return new NextResponse(result.body as unknown as BodyInit, {
      status: result.status,
      headers: filteredHeaders,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[preview-proxy] projectId=${projectId} failed error=${errMsg}`);
    return friendlyHtml('Preview is starting or unavailable. Please retry.');
  }
}
