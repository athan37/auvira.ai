import ts from 'typescript';
import { hasInvalidNextJsPageExports } from '@/lib/site-manager/siteConfigAgentMarkers';

/**
 * Fast TS/TSX syntax check (catches broken JSX before preview dev server fails).
 */
export function checkTsxSyntax(source: string, fileName: string): string[] {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      strict: false,
    },
    reportDiagnostics: true,
    fileName,
  });

  const diagnostics = result.diagnostics ?? [];
  return diagnostics.map((d) => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (d.file && typeof d.start === 'number') {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      return `${fileName}:${line + 1}:${character + 1} ${msg}`;
    }
    return `${fileName}: ${msg}`;
  });
}

export function isValidTsxSource(source: string, fileName: string): boolean {
  return checkTsxSyntax(source, fileName).length === 0;
}

/**
 * Validate syntax of changed workspace source files (.ts/.tsx/.jsx).
 */
export async function validateChangedSourceSyntax(
  readFile: (rel: string) => Promise<string | null>,
  changedFiles: string[]
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  for (const rel of changedFiles) {
    if (!/\.(tsx|jsx|ts|js)$/i.test(rel)) continue;
    const content = await readFile(rel);
    if (!content) continue;
    const normalized = rel.replace(/\\/g, '/');
    if (
      (normalized === 'src/app/page.tsx' || normalized.endsWith('/src/app/page.tsx')) &&
      hasInvalidNextJsPageExports(content)
    ) {
      errors.push(
        `${rel}: contains invalid Next.js page export (legacy agent sync stamp); rebuild preview or re-run edit`
      );
      continue;
    }
    const ext = rel.split('.').pop()?.toLowerCase() ?? 'tsx';
    const fileName = `file.${ext}`;
    for (const msg of checkTsxSyntax(content, fileName)) {
      errors.push(`${rel}: ${msg}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
