'use client';

import type { IntroDemoId } from '@/content/marketing';
import type { IntroAccentId } from '@/content/marketingTheme';
import { IntroTeamsDemo } from './IntroTeamsDemo';
import { IntroMemoryDemo } from './IntroMemoryDemo';
import { IntroDescribeDemo } from './IntroDescribeDemo';
import { IntroCloneDemo } from './IntroCloneDemo';
import { IntroVisionEditDemo } from './IntroVisionEditDemo';

/** Renders the marketing animation for an intro narrative section. */
export function IntroSectionDemo({
  demo,
  accentId,
}: {
  demo: IntroDemoId;
  accentId: IntroAccentId;
}) {
  switch (demo) {
    case 'teamsToChat':
      return <IntroTeamsDemo />;
    case 'memory':
      return <IntroMemoryDemo />;
    case 'describe':
      return (
        <IntroDescribeDemo
          dotClassName={accentId === 'websites' ? 'bg-rose-700' : 'bg-rose-600'}
          cursorClassName={accentId === 'websites' ? 'bg-rose-700' : 'bg-rose-600'}
        />
      );
    case 'cloneFromUrl':
      return <IntroCloneDemo />;
    case 'dragToChat':
      return <IntroVisionEditDemo />;
    default:
      return null;
  }
}
