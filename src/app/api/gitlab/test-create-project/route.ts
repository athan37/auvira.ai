import { NextRequest, NextResponse } from 'next/server';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const project = await createGitLabProject({
      name,
      description: `Demo project: ${name}`,
    });

    const readmeContent = `# ${name}\n\nThis is a demo project created via the AI Website Migration Agent.\n`;

    const commit = await commitFilesToGitLab({
      projectId: project.id,
      commitMessage: 'Initial commit: Add README',
      files: [
        {
          filePath: 'README.md',
          content: readmeContent,
        },
      ],
    });

    return NextResponse.json({
      project,
      commit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}