import { getSandboxGateway } from './sandboxWorkspaceGateway';
import { repairPageTsxStructure } from '@/lib/project-workspace/repairPageTsxStructure';
import { repairSiteConfigTypesViaGateway } from '@/lib/preview/repairSiteConfigTypes';

type FileOps = {
  read: (rel: string) => Promise<string | null>;
  write: (rel: string, content: string) => Promise<void>;
};

async function repairPageToSiteConfigSchema(ops: FileOps): Promise<void> {
  const content = await ops.read('src/app/page.tsx');
  if (!content) return;

  let next = content;
  let changed = false;
  const replacements: Array<[string, string]> = [
    ['siteConfig.hero.title', 'siteConfig.hero.headline'],
    ['siteConfig.hero.subtitle', 'siteConfig.hero.subheadline'],
    ['siteConfig.contact.title', "'Contact Us'"],
    ['siteConfig.contact.subtitle', '(siteConfig.tagline || "")'],
    ['siteConfig.footer.tagline', '(siteConfig.tagline || "")'],
    ['siteConfig.footer.copyright', '(`© ${new Date().getFullYear()} ${siteConfig.businessName}`)'],
    ['siteConfig.navigation.map', '(siteConfig.navigation ?? []).map'],
    ['siteConfig.hero.cta.map', '(siteConfig.hero?.cta ?? []).map'],
    ['siteConfig.contact.phone.replace', '(siteConfig.contact?.phone || "").replace'],
    ['mailto:${siteConfig.contact.email}', 'mailto:${siteConfig.contact?.email || "hello@example.com"}'],
  ];

  for (const [from, to] of replacements) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
      changed = true;
    }
  }

  if (changed) {
    await ops.write('src/app/page.tsx', next);
  }
}

async function ensureSiteConfigNavigation(ops: FileOps): Promise<void> {
  const content = await ops.read('src/lib/siteConfig.ts');
  if (!content || content.includes('navigation')) return;

  const navBlock = `  "navigation": [
    { "label": "Home", "href": "#top" },
    { "label": "Services", "href": "#services" },
    { "label": "Contact", "href": "#contact" }
  ],
`;

  if (content.includes('"sections":')) {
    await ops.write(
      'src/lib/siteConfig.ts',
      content.replace(/"sections":/, `${navBlock}  "sections":`)
    );
  }
}

/** Apply preview-safe repairs inside the sandbox VM (via gateway). */
export async function repairPreviewSandbox(projectId: string): Promise<void> {
  const gateway = await getSandboxGateway(projectId);
  const ops: FileOps = {
    read: async (rel) => {
      try {
        return await gateway.readFile(rel);
      } catch {
        return null;
      }
    },
    write: async (rel, body) => {
      await gateway.writeFile(rel, body);
    },
  };

  await repairSiteConfigTypesViaGateway(gateway);
  await repairPageToSiteConfigSchema(ops);
  await ensureSiteConfigNavigation(ops);

  const page = await ops.read('src/app/page.tsx');
  if (page) {
    const { content, repaired } = repairPageTsxStructure(page);
    if (repaired) {
      await ops.write('src/app/page.tsx', content);
    }
  }
}
