import { existsSync, mkdirSync, writeFileSync, cpSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { getNpmPath } from '@/lib/runtime/nodeRuntime';

const RUNTIME_DIR = '.tmp/preview-runtime';

const RUNTIME_FILES = [
  {
    filePath: 'package.json',
    content: JSON.stringify({
      name: 'preview-runtime',
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev -H 0.0.0.0',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        next: '^14.2.0',
        react: '^18.3.0',
        'react-dom': '^18.3.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        typescript: '^5.4.0',
      },
    }, null, 2),
  },
  {
    filePath: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: false,
};
module.exports = nextConfig;
`,
  },
  {
    filePath: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./src/*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2),
  },
  {
    filePath: 'tailwind.config.js',
    content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {} },
  plugins: [],
};
`,
  },
  {
    filePath: 'postcss.config.js',
    content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
  },
  {
    filePath: 'src/app/layout.tsx',
    content: `import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Preview',
  description: 'Website preview',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`,
  },
  {
    filePath: 'src/app/globals.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-rgb: 249, 250, 251;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}
`,
  },
  {
    filePath: 'src/app/page.tsx',
    content: `'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PreviewPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setError('No projectId provided');
      setLoading(false);
      return;
    }

    fetch(\`/api/projects/\${projectId}/preview/site-data\`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.html) {
          setContent(data.html);
        } else {
          setError(data.error || 'Failed to load preview');
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center">
          <p className="text-red-600 font-medium">Preview error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: content }} />
  );
}
`,
  },
];

function writeRuntimeFiles(runtimePath: string) {
  mkdirSync(runtimePath, { recursive: true });
  for (const file of RUNTIME_FILES) {
    const filePath = join(runtimePath, file.filePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, file.content, 'utf-8');
  }
}

/**
 * Ensures a cached preview runtime exists at .tmp/preview-runtime/.
 * On first call: creates the directory structure and runs npm install.
 * On subsequent calls: does nothing (node_modules already present).
 */
export async function ensurePreviewRuntime(): Promise<void> {
  const runtimePath = join(process.cwd(), RUNTIME_DIR);
  const packageJsonPath = join(runtimePath, 'package.json');
  const nodeModulesPath = join(runtimePath, 'node_modules');

  if (existsSync(nodeModulesPath)) {
    console.log('[preview-runtime] using cached runtime');
    return;
  }

  console.log('[preview-runtime] installing dependencies first time');
  writeRuntimeFiles(runtimePath);

  await new Promise<void>((resolve, reject) => {
    const npm = spawn(getNpmPath(), ['install', '--legacy-peer-deps'], {
      cwd: runtimePath,
      shell: false,
      stdio: 'inherit',
    });
    npm.on('close', (code) => {
      if (code === 0) {
        console.log('[preview-runtime] install complete');
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });
    npm.on('error', reject);
  });
}

export function copyRuntimeToProject(projectId: string, spec: Record<string, unknown>): string {
  const projectPath = join(process.cwd(), '.tmp', 'project-previews', projectId);

  if (!existsSync(projectPath)) {
    // Copy base runtime to project workspace
    const runtimePath = join(process.cwd(), RUNTIME_DIR);
    mkdirSync(projectPath, { recursive: true });
    cpSync(runtimePath, projectPath, { recursive: true, filter: (_src, dest) => {
      // Don't copy node_modules — they'll be symlinked or reused
      return !dest.includes('node_modules');
    }});
  }

  return projectPath;
}

export function workspacePathForProject(projectId: string): string {
  return join(process.cwd(), '.tmp', 'project-previews', projectId);
}