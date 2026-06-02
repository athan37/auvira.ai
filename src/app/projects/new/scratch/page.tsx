'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import ProposedPlanCard from '@/components/clone/ProposedPlanCard';
import { LayoutStarterPicker } from '@/components/scratch/LayoutStarterPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageContainer } from '@/components/ui/PageContainer';
import { Spinner } from '@/components/ui/Spinner';
import type { WebsitePlan } from '@/lib/agent/schemas';
import type { LayoutStarter, LayoutStarterId } from '@/lib/builder/layoutStarters';
import { websitePlanToProposedPlan } from '@/lib/scratch/websitePlanToProposedPlan';

type ScratchStep = 'intake' | 'review';
type ScratchProgressStage = 'idle' | 'planning' | 'building' | 'saving';

const SCRATCH_PROGRESS_STEPS: Array<{ key: ScratchProgressStage; label: string }> = [
  { key: 'planning', label: 'Planning' },
  { key: 'building', label: 'Building' },
  { key: 'saving', label: 'Saving' },
];

function ScratchProgressSteps({ stage }: { stage: ScratchProgressStage }) {
  if (stage === 'idle') return null;

  const stageOrder: ScratchProgressStage[] = ['planning', 'building', 'saving'];
  const activeIndex = stageOrder.indexOf(stage);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
      <p className="text-sm font-medium text-zinc-800">Creating your website</p>
      <ol className="space-y-2">
        {SCRATCH_PROGRESS_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = step.key === stage;
          return (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? 'bg-emerald-100 text-emerald-700'
                    : active
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-200 text-zinc-500'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
              <span className={active ? 'font-medium text-zinc-900' : 'text-zinc-600'}>{step.label}</span>
              {active && <Spinner size="sm" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function NewScratchPage() {
  const { status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<ScratchStep>('intake');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [services, setServices] = useState('');
  const [mainGoal, setMainGoal] = useState('Get more leads');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedStarter, setSelectedStarter] = useState<LayoutStarter | null>(null);
  const [websitePlan, setWebsitePlan] = useState<WebsitePlan | null>(null);
  const [layoutStarterId, setLayoutStarterId] = useState<LayoutStarterId | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStage, setProgressStage] = useState<ScratchProgressStage>('idle');
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

  const intakePayload = {
    businessName: businessName.trim(),
    industry: industry.trim(),
    location: location.trim(),
    services: services.trim(),
    mainGoal,
    phone: phone.trim(),
    email: email.trim(),
  };

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !industry.trim()) return;

    setLoading(true);
    setError(null);
    setProgressStage('planning');

    try {
      const proposeRes = await fetch('/api/projects/scratch/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...intakePayload,
          layoutStarterId: selectedStarter?.id,
        }),
      });
      const proposeData = await proposeRes.json();
      if (!proposeData.ok) {
        setError(proposeData.error || 'Failed to create plan');
        setProgressStage('idle');
        return;
      }

      setWebsitePlan(proposeData.websitePlan as WebsitePlan);
      setLayoutStarterId(
        (proposeData.layoutStarterId as LayoutStarterId | undefined) ??
          selectedStarter?.id ??
          proposeData.websitePlan?.suggestedTemplate?.layoutStarterId ??
          null
      );
      setStep('review');
      setProgressStage('idle');
    } catch {
      setError('Network error');
      setProgressStage('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleBuild = async () => {
    if (!websitePlan) return;

    setLoading(true);
    setError(null);
    setProgressStage('building');

    try {
      const buildRes = await fetch('/api/projects/scratch/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websitePlan,
          projectName: businessName.trim(),
          layoutStarterId: layoutStarterId ?? websitePlan.suggestedTemplate?.layoutStarterId,
          intake: {
            ...intakePayload,
            targetCustomers: '',
            address: '',
            desiredStyle: selectedStarter?.category || websitePlan.suggestedTemplate?.category || 'professional',
            notes: '',
          },
        }),
      });
      const buildData = await buildRes.json();
      if (buildData.ok && buildData.projectId) {
        setProgressStage('saving');
        if (buildData.warning) {
          sessionStorage.setItem(
            `project-warning-${buildData.projectId}`,
            String(buildData.warning)
          );
        }
        router.push(`/projects/${buildData.projectId}`);
      } else {
        setError(buildData.error || 'Failed to build website');
        setProgressStage('idle');
      }
    } catch {
      setError('Network error');
      setProgressStage('idle');
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
                {step === 'intake'
                  ? 'Tell us about your business and pick a layout starter. We will propose a plan before building.'
                  : 'Review your proposed website plan, then confirm to build.'}
              </p>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <ScratchProgressSteps stage={progressStage} />

            {step === 'intake' ? (
              <form onSubmit={handlePropose} className="space-y-4">
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

                <LayoutStarterPicker
                  selectedId={selectedStarter?.id ?? layoutStarterId}
                  onSelect={setSelectedStarter}
                  disabled={loading}
                />

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner size="sm" />
                      Creating plan…
                    </>
                  ) : (
                    'Continue to plan review'
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <ProposedPlanCard
                  plan={websitePlan ? websitePlanToProposedPlan(websitePlan) : null}
                  suggestedTemplate={websitePlan?.suggestedTemplate}
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={loading}
                    onClick={() => {
                      setStep('intake');
                      setError(null);
                    }}
                  >
                    Back to intake
                  </Button>
                  <Button type="button" className="w-full sm:flex-1" disabled={loading} onClick={handleBuild}>
                    {loading ? (
                      <>
                        <Spinner size="sm" />
                        Building your website…
                      </>
                    ) : (
                      'Confirm and build website'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
