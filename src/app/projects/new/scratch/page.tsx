'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import ProposedPlanCard from '@/components/clone/ProposedPlanCard';
import { TemplateGalleryPicker } from '@/components/clone/TemplateGalleryPicker';
import { ScratchDesignPreviewPanel } from '@/components/scratch/ScratchDesignPreviewPanel';
import { ScratchFormSection } from '@/components/scratch/ScratchFormSection';
import { StarterGalleryPicker } from '@/components/scratch/StarterGalleryPicker';
import { CategoryPresetPicker } from '@/components/scratch/CategoryPresetPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { PageContainer } from '@/components/ui/PageContainer';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import type { WebsitePlan } from '@/lib/agent/schemas';
import {
  getCategoryPreset,
  recommendCategoryFromIndustry,
  type WebsiteCategoryId,
} from '@/lib/builder/categoryPresets';
import {
  recommendLayoutStarterForIndustry,
  getLayoutStarter,
  type LayoutStarter,
  type LayoutStarterId,
} from '@/lib/builder/layoutStarters';
import { getTemplateGallery, type TemplateGalleryEntry } from '@/lib/builder/templateGallery';
import { websitePlanToProposedPlan } from '@/lib/scratch/websitePlanToProposedPlan';

type ScratchStep = 'category' | 'intake' | 'review';
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

const HOW_IT_WORKS = [
  'Tell us about your business and pick layout + colors',
  'Review the AI-proposed plan (edit before building)',
  'Build a draft site in your workspace',
  'Refine with chat and publish when ready',
] as const;

const selectClassName =
  'w-full h-11 rounded-xl border border-[#d2d2d7] bg-white px-4 text-[17px] text-[#1d1d1f] focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-[#f5f5f7] disabled:text-[#86868b]';

function ScratchProgressSteps({ stage }: { stage: ScratchProgressStage }) {
  if (stage === 'idle' || stage === 'revising') return null;

  const stageOrder: ScratchProgressStage[] = ['planning', 'building', 'saving'];
  const activeIndex = stageOrder.indexOf(stage);

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/80 bg-[#f5f5f7] p-4 space-y-3">
      <p className="text-sm font-medium text-[#1d1d1f]">Creating your website</p>
      <ol className="space-y-2">
        {SCRATCH_PROGRESS_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = step.key === stage;
          return (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? 'bg-brand-100 text-brand-700'
                    : active
                      ? 'bg-brand-600 text-white'
                      : 'bg-[#d2d2d7]/60 text-[#86868b]'
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

function ScratchStepPill({
  step,
  hasPlan,
  onIntake,
  onReview,
}: {
  step: ScratchStep;
  hasPlan: boolean;
  onIntake: () => void;
  onReview: () => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
      <button
        type="button"
        onClick={onIntake}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          step === 'intake' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
        )}
      >
        Intake
      </button>
      <button
        type="button"
        onClick={onReview}
        disabled={!hasPlan}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          step === 'review' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900',
          !hasPlan && 'cursor-not-allowed opacity-50'
        )}
      >
        Review
      </button>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h3 className="text-sm font-medium text-zinc-700 mb-2">How it works</h3>
      <ol className="text-sm text-zinc-500 space-y-1 list-decimal list-inside">
        {HOW_IT_WORKS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </div>
  );
}

export default function NewScratchPage() {
  const { status } = useSession();
  const router = useRouter();
  const defaultTheme = useMemo(
    () => getTemplateGallery().find((t) => t.variant === 'modern-clean') ?? getTemplateGallery()[0],
    []
  );
  const [step, setStep] = useState<ScratchStep>('category');
  const [categoryPresetId, setCategoryPresetId] = useState<WebsiteCategoryId>('service_business');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [services, setServices] = useState('');
  const [mainGoal, setMainGoal] = useState<string>(MAIN_GOAL_OPTIONS[0]);
  const [targetCustomers, setTargetCustomers] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [selectedStarter, setSelectedStarter] = useState<LayoutStarter | null>(null);
  const [layoutManuallySelected, setLayoutManuallySelected] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<TemplateGalleryEntry>(defaultTheme);
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
    desiredStyle: selectedTheme.category || selectedStarter?.category || 'professional',
    notes: notes.trim(),
  };

  const resolvedLayoutStarterId =
    layoutStarterId ?? selectedStarter?.id ?? websitePlan?.suggestedTemplate?.layoutStarterId ?? undefined;

  const templateSelectionPayload = {
    templateCategory: selectedTheme.category,
    templateVariant: selectedTheme.variant,
  };

  const canPropose = Boolean(businessName.trim() && industry.trim());
  const readinessItems = [
    { label: 'Business name', done: Boolean(businessName.trim()) },
    { label: 'Industry', done: Boolean(industry.trim()) },
    { label: 'Layout template (recommended)', done: Boolean(selectedStarter) },
  ];

  const syncPlanTemplate = (updates: {
    layoutStarterId?: LayoutStarterId;
    category?: string;
    variant?: string;
  }) => {
    if (!websitePlan?.suggestedTemplate) return;
    setWebsitePlan({
      ...websitePlan,
      suggestedTemplate: {
        ...websitePlan.suggestedTemplate,
        ...updates,
      },
    });
  };

  const handleIndustryChange = (value: string) => {
    setIndustry(value);
    if (!layoutManuallySelected && value.trim()) {
      const recommendedCategory = recommendCategoryFromIndustry(value);
      setCategoryPresetId(recommendedCategory);
      const presetStarter = getLayoutStarter(getCategoryPreset(recommendedCategory).layoutStarterId);
      if (presetStarter) {
        setSelectedStarter(presetStarter);
        setLayoutStarterId(presetStarter.id);
      } else {
        const recommended = recommendLayoutStarterForIndustry(value);
        setSelectedStarter(recommended);
        setLayoutStarterId(recommended.id);
      }
    }
  };

  const handleCategorySelect = (id: WebsiteCategoryId) => {
    setCategoryPresetId(id);
    if (!layoutManuallySelected) {
      const starter = getLayoutStarter(getCategoryPreset(id).layoutStarterId);
      if (starter) {
        setSelectedStarter(starter);
        setLayoutStarterId(starter.id);
      }
    }
  };

  const handleStarterSelect = (starter: LayoutStarter) => {
    setLayoutManuallySelected(true);
    setSelectedStarter(starter);
    setLayoutStarterId(starter.id);
    syncPlanTemplate({ layoutStarterId: starter.id });
  };

  const handleThemeSelect = (theme: TemplateGalleryEntry) => {
    setSelectedTheme(theme);
    syncPlanTemplate({ category: theme.category, variant: theme.variant });
  };

  const handlePropose = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canPropose) return;

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
          templateCategory: selectedTheme.category,
          templateVariant: selectedTheme.variant,
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
          ...templateSelectionPayload,
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
          categoryPresetId,
          intake: intakePayload,
        }),
      });
      const buildData = await buildRes.json();
      if (buildData.ok && buildData.projectId) {
        setProgressStage('saving');
        if (buildData.warning) {
          sessionStorage.setItem(`project-warning-${buildData.projectId}`, String(buildData.warning));
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

  const categoryPrimaryButton = (
    <Button type="button" className="w-full" onClick={() => setStep('intake')}>
      Continue to business details
    </Button>
  );

  const intakePrimaryButton = (
    <Button
      type="button"
      className="w-full"
      disabled={loading || !canPropose}
      onClick={() => void handlePropose()}
    >
      {loading && progressStage === 'planning' ? (
        <>
          <Spinner size="sm" />
          Creating plan…
        </>
      ) : (
        'Continue to plan review'
      )}
    </Button>
  );

  const reviewPrimaryButton = (
    <Button type="button" className="w-full" disabled={loading || !websitePlan} onClick={handleBuild}>
      {loading && progressStage === 'building' ? (
        <>
          <Spinner size="sm" />
          Building your website…
        </>
      ) : (
        'Confirm and build website'
      )}
    </Button>
  );

  return (
    <AppShell
      variant="minimal"
      breadcrumb={
        <Link href="/dashboard" className="hover:text-zinc-800">
          Start with a prompt
        </Link>
      }
    >
      <PageContainer className="py-8 sm:py-10 pb-28 lg:pb-10 max-w-6xl">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 mb-2">Start with a prompt</h1>
              <p className="text-zinc-600 max-w-2xl">
                {step === 'category'
                  ? 'Choose your business type — we’ll tailor sections, packages, and CTAs for you.'
                  : step === 'intake'
                  ? 'Tell us about your business, then pick a layout template and color theme. We will propose a plan before building.'
                  : 'Review your proposed website plan, revise if needed, then confirm to build.'}
              </p>
            </div>
            <ScratchStepPill
              step={step}
              hasPlan={Boolean(websitePlan)}
              onIntake={() => {
                setStep('intake');
                setError(null);
                setShowRevisionInput(false);
              }}
              onReview={() => {
                if (websitePlan) {
                  setStep('review');
                  setError(null);
                }
              }}
            />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <ScratchProgressSteps stage={progressStage} />

          {step === 'intake' && (
            <ScratchDesignPreviewPanel
              variant="compact"
              businessName={businessName}
              industry={industry}
              selectedStarter={selectedStarter}
              selectedTheme={selectedTheme}
            />
          )}

          {step === 'review' && (
            <ScratchDesignPreviewPanel
              variant="compact"
              businessName={businessName}
              industry={industry}
              selectedStarter={selectedStarter}
              selectedTheme={selectedTheme}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
            <div className="lg:col-span-3 space-y-4 min-w-0">
              {step === 'category' ? (
                <div className="space-y-4">
                  <ScratchFormSection
                    title="Website category"
                    description="Service packages, menus, donation tiers, portfolio work, or startup landing — one template fits all."
                  >
                    <CategoryPresetPicker
                      selectedId={categoryPresetId}
                      onSelect={handleCategorySelect}
                      disabled={loading}
                    />
                  </ScratchFormSection>
                  <HowItWorks />
                </div>
              ) : step === 'intake' ? (
                <form onSubmit={handlePropose} className="space-y-4">
                  <ScratchFormSection
                    title="About your business"
                    description="Required details help us propose the right site structure and copy."
                  >
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="businessName" className="block text-sm font-medium text-zinc-700 mb-1">
                          Business name *
                        </label>
                        <Input
                          id="businessName"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Acme Plumbing"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="industry" className="block text-sm font-medium text-zinc-700 mb-1">
                          Industry *
                        </label>
                        <Input
                          id="industry"
                          value={industry}
                          onChange={(e) => handleIndustryChange(e.target.value)}
                          placeholder="e.g. HVAC, law firm, restaurant"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="location" className="block text-sm font-medium text-zinc-700 mb-1">
                          Location
                        </label>
                        <Input
                          id="location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="City, state or service area"
                        />
                      </div>
                      <div>
                        <label htmlFor="services" className="block text-sm font-medium text-zinc-700 mb-1">
                          Services
                        </label>
                        <Input
                          id="services"
                          value={services}
                          onChange={(e) => setServices(e.target.value)}
                          placeholder="Comma-separated list of services"
                        />
                      </div>
                      <div>
                        <label htmlFor="mainGoal" className="block text-sm font-medium text-zinc-700 mb-1">
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
                    </div>
                  </ScratchFormSection>

                  <ScratchFormSection title="Optional details">
                    <button
                      type="button"
                      onClick={() => setOptionalOpen((open) => !open)}
                      className="flex w-full items-center justify-between text-sm font-medium text-zinc-700"
                    >
                      <span>{optionalOpen ? 'Hide optional fields' : 'Add contact info and notes'}</span>
                      <span className="text-zinc-400">{optionalOpen ? '−' : '+'}</span>
                    </button>
                    {optionalOpen && (
                      <div className="space-y-4 pt-2">
                        <div>
                          <label htmlFor="targetCustomers" className="block text-sm font-medium text-zinc-700 mb-1">
                            Target customers
                          </label>
                          <Input
                            id="targetCustomers"
                            value={targetCustomers}
                            onChange={(e) => setTargetCustomers(e.target.value)}
                            placeholder="e.g. homeowners, small businesses"
                          />
                        </div>
                        <div>
                          <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1">
                            Phone
                          </label>
                          <Input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(555) 123-4567"
                          />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
                            Email
                          </label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="hello@example.com"
                          />
                        </div>
                        <div>
                          <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 mb-1">
                            Style notes
                          </label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Anything else we should know (optional)"
                            rows={3}
                          />
                        </div>
                      </div>
                    )}
                  </ScratchFormSection>

                  <ScratchFormSection
                    title="Choose your look"
                    description="Pick page structure and colors independently — change either anytime before building."
                  >
                    <StarterGalleryPicker
                      hideHeader
                      selectedId={selectedStarter?.id ?? layoutStarterId}
                      onSelect={handleStarterSelect}
                      disabled={loading}
                      industry={industry}
                    />
                    <TemplateGalleryPicker
                      hideHeader
                      selectedCategory={selectedTheme.category}
                      selectedVariant={selectedTheme.variant}
                      onSelect={handleThemeSelect}
                      disabled={loading}
                      description="Pick colors and typography mood independently from the layout above."
                    />
                  </ScratchFormSection>

                  <HowItWorks />
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

                  <ScratchFormSection
                    title="Adjust design"
                    description="Change layout or colors without going back to intake."
                  >
                    <StarterGalleryPicker
                      hideHeader
                      selectedId={selectedStarter?.id ?? layoutStarterId}
                      onSelect={handleStarterSelect}
                      disabled={loading}
                      industry={industry}
                    />
                    <TemplateGalleryPicker
                      hideHeader
                      selectedCategory={selectedTheme.category}
                      selectedVariant={selectedTheme.variant}
                      onSelect={handleThemeSelect}
                      disabled={loading}
                    />
                  </ScratchFormSection>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => {
                      setStep('intake');
                      setError(null);
                      setShowRevisionInput(false);
                    }}
                  >
                    Back to intake
                  </Button>
                </div>
              )}
            </div>

            <div className="hidden lg:block lg:col-span-2 min-w-0 self-stretch">
              <div className="sticky top-[4.5rem] z-10">
                <ScratchDesignPreviewPanel
                  businessName={businessName}
                  industry={industry}
                  selectedStarter={selectedStarter}
                  selectedTheme={selectedTheme}
                  sticky={false}
                  showReadiness={step === 'intake'}
                  readinessItems={readinessItems}
                >
                  {step === 'category'
                    ? categoryPrimaryButton
                    : step === 'intake'
                      ? intakePrimaryButton
                      : reviewPrimaryButton}
                </ScratchDesignPreviewPanel>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
        <div className="mx-auto max-w-6xl">
          {step === 'category'
            ? categoryPrimaryButton
            : step === 'intake'
              ? intakePrimaryButton
              : reviewPrimaryButton}
        </div>
      </div>
    </AppShell>
  );
}
