'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TemplateGalleryPicker } from '@/components/clone/TemplateGalleryPicker';
import { StarterGalleryPicker } from '@/components/scratch/StarterGalleryPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageContainer } from '@/components/ui/PageContainer';
import { Spinner } from '@/components/ui/Spinner';
import type { LayoutStarter } from '@/lib/builder/layoutStarters';
import { getTemplateGallery, type TemplateGalleryEntry } from '@/lib/builder/templateGallery';

export default function NewClonePage() {
  const { status } = useSession();
  const router = useRouter();
  const defaultTheme = useMemo(
    () => getTemplateGallery().find((t) => t.variant === 'modern-clean') ?? getTemplateGallery()[0],
    []
  );

  const [url, setUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedStarter, setSelectedStarter] = useState<LayoutStarter | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateGalleryEntry>(defaultTheme);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/projects/clone/start-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          projectName: projectName.trim(),
          templateCategory: selectedTemplate.category,
          templateVariant: selectedTemplate.variant,
          layoutStarterId: selectedStarter?.id,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        router.push(data.reviewUrl);
      } else {
        setError(data.error || 'Failed to start clone');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      variant="minimal"
      breadcrumb={
        <Link href="/dashboard" className="hover:text-zinc-800">
          Clone a website
        </Link>
      }
    >
      <PageContainer narrow className="py-10">
        <Card>
          <CardBody className="p-8">
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">Clone a website</h1>
            <p className="text-zinc-600 mb-6">
              Paste your current site URL, then pick a layout template and color theme. We copy your
              content into the new look — then you review and publish.
            </p>

            <form onSubmit={handleStart} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="url">
                  Website URL
                </label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-zinc-700 mb-1"
                  htmlFor="projectName"
                >
                  Project name (optional)
                </label>
                <Input
                  id="projectName"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Business Website"
                />
              </div>

              <StarterGalleryPicker
                selectedId={selectedStarter?.id ?? null}
                onSelect={setSelectedStarter}
                disabled={loading}
              />

              <TemplateGalleryPicker
                selectedCategory={selectedTemplate.category}
                selectedVariant={selectedTemplate.variant}
                onSelect={setSelectedTemplate}
                disabled={loading}
                description="Pick colors and typography mood independently from the layout above."
              />

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={loading || !url.trim()}>
                  {loading ? 'Starting clone…' : 'Start clone'}
                </Button>
                <Link href="/projects/new/scratch">
                  <Button type="button" variant="secondary">
                    Start without a URL
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-zinc-100">
              <h3 className="text-sm font-medium text-zinc-700 mb-2">How it works</h3>
              <ol className="text-sm text-zinc-500 space-y-1 list-decimal list-inside">
                <li>Crawl your existing site for content and contact info</li>
                <li>Review the proposed plan (change layout or theme anytime before build)</li>
                <li>Build a draft preview with your chosen structure and colors</li>
                <li>Publish your live site when ready</li>
              </ol>
            </div>
          </CardBody>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
