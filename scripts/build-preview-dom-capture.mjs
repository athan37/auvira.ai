#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'src/lib/preview/generated/domBitmapCapture.bundle.js');

mkdirSync(dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'src/lib/preview/domBitmapCaptureEntry.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'PreviewDomCapture',
  platform: 'browser',
  target: ['es2020'],
  outfile,
  minify: true,
  legalComments: 'none',
});

console.log(`Wrote ${outfile}`);
