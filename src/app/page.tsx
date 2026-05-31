import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/PageContainer';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Site Agent - AI Website Migration',
  description:
    'Clone an outdated business website or start from scratch, then improve and publish it through a guided AI workflow.',
};

const workflowSteps = [
  {
    eyebrow: '01',
    title: 'Start with a URL or a blank slate',
    detail:
      'Clone an existing small-business website, or answer a short setup form when there is no current site to reuse.',
  },
  {
    eyebrow: '02',
    title: 'Approve the plan before build',
    detail:
      'Site Agent extracts the real business facts, recommends a structure, and keeps you in control before it generates the draft.',
  },
  {
    eyebrow: '03',
    title: 'Edit in plain language',
    detail:
      'Ask for practical changes like new pricing, a better headline, a product grid, or a more premium visual direction.',
  },
  {
    eyebrow: '04',
    title: 'Publish with a build gate',
    detail:
      'Every generated site is built and checked before it can become the live website, so broken updates stay out of production.',
  },
] as const;

const featureCards = [
  {
    title: 'Clone mode',
    detail:
      'Paste a website URL and turn the existing content into a fresh Next.js site with modern layout, clean copy, and deployable code.',
  },
  {
    title: 'Scratch mode',
    detail:
      'Create a new business site from a guided brief when there is no website to crawl or the old one should not be reused.',
  },
  {
    title: 'Owner editor',
    detail:
      'Review the draft preview, request changes through chat, inspect updates, save a backup copy, and publish when ready.',
  },
] as const;

const reliabilityItems = [
  'Real business facts are extracted before generation.',
  'The LLM writes structured data, not arbitrary application code.',
  'Local build validation runs before commits and deploys.',
  'Live status appears only after the deployed version is ready.',
] as const;

function LandingLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20 focus-visible:ring-offset-2',
        variant === 'primary'
          ? 'bg-zinc-950 text-white hover:bg-zinc-800'
          : 'border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
      )}
    >
      {children}
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

/** Public product landing page for visitors; authenticated users continue to the dashboard. */
export default async function Home() {
  const session = await auth();

  if (session) redirect('/dashboard');

  return (
    <main className="min-h-screen overflow-hidden bg-vercel-grid">
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur">
        <PageContainer className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Site Agent home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-sm font-bold text-white">
              S
            </span>
            <span className="text-sm font-semibold text-zinc-950">Site Agent</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 sm:flex">
            <a href="#how-it-works" className="hover:text-zinc-950">
              How it works
            </a>
            <a href="#use-cases" className="hover:text-zinc-950">
              Modes
            </a>
            <a href="#reliability" className="hover:text-zinc-950">
              Reliability
            </a>
          </nav>
          <LandingLink href="/auth/signin" variant="secondary">
            Sign in
          </LandingLink>
        </PageContainer>
      </header>

      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-white via-white/80 to-transparent" />
        <PageContainer className="grid gap-12 py-20 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:py-28">
          <div>
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-card">
              AI website migration for small businesses
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-6xl lg:text-7xl">
              Turn an outdated website into a clean, editable live site.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              Site Agent helps business owners clone an existing site or start from a brief,
              review a draft preview, request changes in chat, and publish a production-ready
              website without touching code.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LandingLink href="/auth/signin">Start a website &rarr;</LandingLink>
              <LandingLink href="#how-it-works" variant="secondary">
                See how it works
              </LandingLink>
            </div>
            <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-3">
              {[
                ['2', 'ways to start'],
                ['4', 'guided steps'],
                ['1', 'live publish flow'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-semibold text-zinc-950">{value}</dt>
                  <dd className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <Card className="relative overflow-hidden border-zinc-200 bg-white/95 p-4 shadow-card-hover">
            <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-white">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs text-zinc-400">Draft preview</p>
                  <p className="mt-1 text-sm font-semibold">Northstar Dental</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  Ready to publish
                </span>
              </div>
              <div className="mt-5 rounded-lg bg-white p-5 text-zinc-950">
                <div className="h-3 w-24 rounded-full bg-zinc-200" />
                <div className="mt-8 h-8 w-4/5 rounded-full bg-zinc-950" />
                <div className="mt-3 h-8 w-3/5 rounded-full bg-zinc-900" />
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="h-20 rounded-lg bg-zinc-100" />
                  <div className="h-20 rounded-lg bg-zinc-100" />
                  <div className="h-20 rounded-lg bg-zinc-100" />
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Chat edit</p>
                <p className="mt-2 text-sm text-zinc-700">
                  &quot;Make the hero warmer and add financing details.&quot;
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Build gate</p>
                <p className="mt-2 text-sm text-zinc-700">
                  Passed locally before backup and live publish.
                </p>
              </div>
            </div>
          </Card>
        </PageContainer>
      </section>

      <section id="how-it-works" className="border-y border-zinc-200/80 bg-white">
        <PageContainer className="py-20">
          <SectionHeading
            eyebrow="How it works"
            title="A guided path from messy site to live website"
            description="The workflow is built for owners who need clarity: choose a starting point, review the plan, refine the draft, then publish only when the build is healthy."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step) => (
              <Card key={step.title} className="p-5 transition-all hover:border-zinc-300 hover:shadow-card-hover">
                <p className="text-xs font-semibold text-zinc-400">{step.eyebrow}</p>
                <h3 className="mt-4 text-lg font-semibold text-zinc-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{step.detail}</p>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      <section id="use-cases" className="bg-zinc-50/80">
        <PageContainer className="py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <SectionHeading
              eyebrow="What you can do"
              title="Choose the workflow that matches your business"
              description="Site Agent supports both migration and new-site creation, then gives every project the same owner-friendly editing and publishing loop."
            />
            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map((feature) => (
                <Card key={feature.title} className="p-5">
                  <h3 className="text-lg font-semibold text-zinc-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{feature.detail}</p>
                </Card>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="reliability" className="bg-white">
        <PageContainer className="grid gap-10 py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <SectionHeading
            eyebrow="Built for trust"
            title="AI assistance with practical guardrails"
            description="The product keeps generation structured and validates the result before it reaches a repository or production deployment."
          />
          <Card className="p-6">
            <ul className="space-y-4">
              {reliabilityItems.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-700">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-bold text-white">
                    &#10003;
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </PageContainer>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-950">
        <PageContainer className="py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to rebuild a business website?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Sign in, create a project, and choose whether to clone an existing URL or start from
            a short business brief.
          </p>
          <div className="mt-8">
            <LandingLink href="/auth/signin" variant="secondary">
              Get started with Site Agent
            </LandingLink>
          </div>
        </PageContainer>
      </section>
    </main>
  );
}