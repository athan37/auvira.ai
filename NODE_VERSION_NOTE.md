# Node.js Version Requirement Note

## Problem

Next.js requires Node.js >= v18.17.0. The default system Node is v16.13.0 which is insufficient.

When running `npx next dev` or `npm install` via `spawn()`, it uses the system Node (v16) which fails with:
```
You are using Node.js 16.13.0. For Next.js, Node.js version >= v18.17.0 is required.
```

## Solution

Always use explicit Node 20 paths for Next.js operations:

```typescript
const NODE20_BIN = '/Users/anhthan/.nvm/versions/node/v20.20.2/bin';

// For npm commands:
spawn(`${NODE20_BIN}/npm`, ['install', '--legacy-peer-deps'], { cwd: workspacePath });

// For next dev - use Node 20 directly with next binary path:
spawn(process.execPath, [nextBinPath, 'dev', ...], { cwd: workspacePath });
// OR use NODE20_BIN/node directly
```

## Files Affected (must use Node 20)

| File | Issue | Status |
|------|-------|--------|
| `src/app/api/projects/clone/jobs/[jobId]/build-preview/route.ts` | `spawn('npm', ...)` and `npx next dev` | ✅ Fixed |
| `src/lib/preview/ensurePreviewRuntime.ts` | `spawn('npm', ...)` at line 219 | ❌ Needs fix |
| `src/app/api/projects/[projectId]/preview/start/route.ts` | Uses `process.execPath` - OK if server runs Node 20 | ✅ Should work |

## Root Cause

When using `spawn('npx', ...)` or `spawn('npm', ...)`, it uses the shell's PATH which resolves to system Node 16. Need to use absolute paths to Node 20 binaries.