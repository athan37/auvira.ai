'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import ProposedPlanCard from '@/components/clone/ProposedPlanCard';
import { StarterGalleryPicker } from '@/components/scratch/StarterGalleryPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { PageContainer } from '@/components/ui/PageContainer';
import { Spinner } from '@/components/ui/Spinner';
import type { WebsitePlan } from '@/lib/agent/schemas';
import type { LayoutStarter, LayoutStarterId } from '@/lib/builder/layoutStarters';
import { websitePlanToProposedPlan } from '@/lib/scratch/websitePlanToProposedPlan';

type ScratchStep = 'intake' | 'review';
type ScratchProgressStage = 'idle' | 'planning' | 'revising' | 'building' | 'saving';

const MAIN_GOAL_OPTIONS = [
  'Get more leads',
  'Book appointments',
  'Build brand awareness',
  'Showcase services',
] as const;

const SCRATCH_PROGRESS_STEPS: Array<{ key: Exclude<ScratchProgressStage, 'idle' | 'revising'>; label: string }> = [
  { key: 'planning', label: 'Planning' },
  { key: 'building', label: 'Building' },
  { key: 'saving', label: 'Saving' },
];

const selectClassName =
  'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10 disabled:bg-zinc-50 disabled:text-zinc-500';

function ScratchProgressSteps({ stage }: { stage: ScratchProgressStage }) {
  if (stage === 'idle' || stage === 'revising') return null;

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
  const [mainGoal, setMainGoal] = useState<string>(MAIN_GOAL_OPTIONS[0]);
  const [targetCustomers, setTargetCustomers] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedStarter, setSelectedStarter] = useState<LayoutStarter | null>(null);
  const [websitePlan, setWebsitePlan] = useState<WebsitePlan | null>(null);
  const [layoutStarterId, setLayoutStarterId] = useState<LayoutStarterId | null>(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
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
    targetCustomers: targetCustomers.trim(),
    phone: phone.trim(),
    email: email.trim(),
    address: '',
    desiredStyle: selectedStarter?.category || 'professional',
    notes: notes.trim(),
  };

  const resolvedLayoutStarterId =
    layoutStarterId ?? selectedStarter?.id ?? websitePlan?.suggestedTemplate?.layoutStarterId ?? undefined;

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

  const handleRevise = async () => {
    if (!websitePlan || !revisionNote.trim()) return;

    setLoading(true);
    setError(null);
    setProgressStage('revising');

    try {
      const reviseRes = await fetch('/api/projects/scratch/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websitePlan,
          instruction: revisionNote.trim(),
          layoutStarterId: resolvedLayoutStarterId,
          intake: intakePayload,
        }),
      });
      const reviseData = await reviseRes.json();
      if (!reviseData.ok) {
        setError(reviseData.error || 'Failed to revise plan');
        setProgressStage('idle');
        return;
      }

      setWebsitePlan(reviseData.websitePlan as WebsitePlan);
      setLayoutStarterId(reviseData.layoutStarterId ?? resolvedLayoutStarterId ?? null);
      setRevisionNote('');
      setShowRevisionInput(false);
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
          layoutStarterId: resolvedLayoutStarterId,
          intake: intakePayload,
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
                  : 'Review your proposed website plan, revise if needed, then confirm to build.'}
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
                <div className="space-y-1">
                  <label htmlFor="mainGoal" className="text-xs font-medium text-zinc-600">
                    Main goal
                  </label>
                  <select
                    id="mainGoal"
                    className={selectClassName}
                    value={mainGoal}
                    onChange={(e) => setMainGoal(e.target.value)}
                  >
                    {MAIN_GOAL_OPTIONS.map((goal) => (
                      <option key={goal} value={goal}>
                        {goal}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  placeholder="Target customers (e.g. homeowners, small businesses)"
                  value={targetCustomers}
                  onChange={(e) => setTargetCustomers(e.target.value)}
                />
                <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Textarea
                  placeholder="Style notes or anything else we should know (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />

                <StarterGalleryPicker
                  selectedId={selectedStarter?.id ?? layoutStarterId}
                  onSelect={setSelectedStarter}
                  disabled={loading}
                  industry={industry}
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

                {showRevisionInput ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
                    <div>
                      <h2 className="text-sm font-medium text-zinc-900">Revise plan</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Describe how you want the proposed plan changed before building.
                      </p>
                    </div>
                    <Textarea
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      placeholder="e.g. Add a FAQ section and make the primary CTA about booking a consultation"
                      rows={4}
                      disabled={loading}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={loading || !revisionNote.trim()}
                        onClick={handleRevise}
                      >
                        {loading && progressStage === 'revising' ? (
                          <>
                            <Spinner size="sm" />
                            Revising…
                          </>
                        ) : (
                          'Apply revision'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={() => {
                          setShowRevisionInput(false);
                          setRevisionNote('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => setShowRevisionInput(true)}
                  >
                    Revise plan
                  </Button>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={loading}
                    onClick={() => {
                      setStep('intake');
                      setError(null);
                      setShowRevisionInput(false);
                    }}
                  >
                    Back to intake
                  </Button>
                  <Button type="button" className="w-full sm:flex-1" disabled={loading} onClick={handleBuild}>
                    {loading && progressStage === 'building' ? (
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
