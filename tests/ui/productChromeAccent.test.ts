import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS_ROOT = join(process.cwd(), 'src/components');

/** Walk `src/components` and collect `.tsx` / `.ts` file paths. */
function walkComponents(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkComponents(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe('product chrome accent guard', () => {
  it('does not use legacy green primary CTAs or blue brand-600 buttons in components', () => {
    const offenders: string[] = [];
    const banned = [/bg-green-600/, /bg-green-500/, /bg-brand-600/];

    for (const file of walkComponents(COMPONENTS_ROOT)) {
      const rel = file.replace(process.cwd() + '/', '');
      if (rel === 'src/components/ui/buttonStyles.ts') continue;
      const content = readFileSync(file, 'utf8');
      for (const pattern of banned) {
        if (pattern.test(content)) {
          offenders.push(`${rel} matches ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
