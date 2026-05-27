'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TemplateGalleryPicker } from '@/components/clone/TemplateGalleryPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageContainer } from '@/components/ui/PageContainer';
import { Spinner } from '@/components/ui/Spinner';
import type { TemplateGalleryEntry } from '@/lib/builder/templateGallery';

export default function NewScratchPage() {
  const { status } = useSession();
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [services, setServices] = useState('');
  const [mainGoal, setMainGoal] = useState('Get more leads');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateGalleryEntry | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !industry.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const proposeRes = await fetch('/api/projects/scratch/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          industry: industry.trim(),
          location: location.trim(),
          services: services.trim(),
          mainGoal,
          phone: phone.trim(),
          email: email.trim(),
        }),
      });
      const proposeData = await proposeRes.json();
      if (!proposeData.ok) {
        setError(proposeData.error || 'Failed to create plan');
        return;
      }

      const plan = proposeData.websitePlan as Record<string, unknown>;
      if (selectedTemplate) {
        plan.suggestedTemplate = {
          category: selectedTemplate.category,
          variant: selectedTemplate.variant,
          reason: 'Selected by owner',
        };
      }

      const buildRes = await fetch('/api/projects/scratch/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websitePlan: plan,
          projectName: businessName.trim(),
          intake: {
            businessName: businessName.trim(),
            industry: industry.trim(),
            location: location.trim(),
            services: services.trim(),
            mainGoal,
            phone: phone.trim(),
            email: email.trim(),
            targetCustomers: '',
            address: '',
            desiredStyle: selectedTemplate?.category || 'professional',
            notes: '',
          },
        }),
      });
      const buildData = await buildRes.json();
      if (buildData.ok && buildData.projectId) {
        if (buildData.warning) {
          sessionStorage.setItem(
            `project-warning-${buildData.projectId}`,
            String(buildData.warning)
          );
        }
        router.push(`/projects/${buildData.projectId}`);
      } else {
        setError(buildData.error || 'Failed to build website');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      variant="minimal"
      breadcrumb={
        <Link href="/dashboard" className="hover:text-zinc-800">
          Start without a URL
        </Link>
      }
    >
      <PageContainer narrow className="py-10">
        <Card>
          <CardBody className="p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 mb-2">Start from a template</h1>
              <p className="text-zinc-600">
                Tell us about your business. We will generate a website you can edit and publish.
              </p>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Business name *"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
              <Input
                placeholder="Industry * (e.g. HVAC, law firm)"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
              />
              <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
              <Input
                placeholder="Services (comma-separated)"
                value={services}
                onChange={(e) => setServices(e.target.value)}
              />
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <TemplateGalleryPicker
                selectedCategory={selectedTemplate?.category}
                selectedVariant={selectedTemplate?.variant}
                onSelect={setSelectedTemplate}
                disabled={loading}
                description="Same color themes as clone — pick the look for your new site."
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Building your website…
                  </>
                ) : (
                  'Create website'
                )}
              </Button>
            </form>
          </CardBody>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
