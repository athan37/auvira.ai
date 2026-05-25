import type { Sandbox } from '@vercel/sandbox';

const MAX_ARG_BYTES = 100_000;

function isSandboxWriteError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('is not ok') || msg.includes('Status code 400');
}

/**
 * Write a UTF-8 file inside the sandbox VM when the Files API returns 400 (large payloads).
 */
export async function writeSandboxFileViaCommand(
  sandbox: Sandbox,
  absPath: string,
  content: string
): Promise<void> {
  const dir = absPath.replace(/\/[^/]+$/, '');
  await sandbox.runCommand({ cmd: 'mkdir', args: ['-p', dir] });

  const encoded = Buffer.from(content, 'utf8').toString('base64');
  if (encoded.length <= MAX_ARG_BYTES) {
    const result = await sandbox.runCommand({
      cmd: 'node',
      args: [
        '-e',
        `const fs=require("fs");const p=process.argv[1];const b=Buffer.from(process.argv[2],"base64");fs.mkdirSync(require("path").dirname(p),{recursive:true});fs.writeFileSync(p,b);`,
        absPath,
        encoded,
      ],
    });
    if (result.exitCode === 0) return;
  }

  const tmpPath = `/tmp/site-agent-write-${Date.now()}.b64`;
  const chunkSize = 48_000;
  await sandbox.fs.writeFile(tmpPath, '', 'utf8');
  for (let i = 0; i < encoded.length; i += chunkSize) {
    const chunk = encoded.slice(i, i + chunkSize);
    const append = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `printf '%s' '${chunk.replace(/'/g, "'\\''")}' >> '${tmpPath}'`],
    });
    if (append.exitCode !== 0) {
      throw new Error('Sandbox chunked write failed while appending base64');
    }
  }

  const decode = await sandbox.runCommand({
    cmd: 'node',
    args: [
      '-e',
      `const fs=require("fs");const src=process.argv[1];const dest=process.argv[2];const b=Buffer.from(fs.readFileSync(src,"utf8"),"base64");fs.mkdirSync(require("path").dirname(dest),{recursive:true});fs.writeFileSync(dest,b);`,
      tmpPath,
      absPath,
    ],
  });
  if (decode.exitCode !== 0) {
    const stderr = await decode.stderr();
    throw new Error(stderr.slice(0, 300) || 'Sandbox decode write failed');
  }
}

/** Prefer SDK fs.writeFile; fall back to in-VM write on 400. */
export async function writeSandboxFile(
  sandbox: Sandbox,
  absPath: string,
  content: string
): Promise<void> {
  try {
    await sandbox.fs.writeFile(absPath, content, 'utf8');
  } catch (err) {
    if (!isSandboxWriteError(err)) throw err;
    await writeSandboxFileViaCommand(sandbox, absPath, content);
  }
}
