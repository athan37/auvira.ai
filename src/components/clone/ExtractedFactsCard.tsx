'use client';

import { BORDER, RADIUS, SURFACE, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface ExtractedFactsSummary {
  businessName?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  services?: string[];
  serviceArea?: string | null;
  hours?: string[] | null;
  socialLinks?: string[];
  contactLinks?: string[];
  bookingLinks?: string[];
}

interface Props {
  facts: ExtractedFactsSummary | null | undefined;
  phase?: string;
}

function FieldRow({ label, value, found }: { label: string; value?: string | string[] | null; found: boolean }) {
  if (!found) {
    const missingText = label === 'Business' || label === 'Industry' ? 'Not found yet' : 'Not found';
    return (
      <div className="flex items-start gap-2">
        <span className={cn('text-sm w-24 flex-shrink-0', TEXT.muted)}>{label}</span>
        <span className={cn('text-xs italic flex-1', TEXT.tertiary)}>{missingText}</span>
        <span className={cn('text-xs', TEXT.tertiary)}>—</span>
      </div>
    );
  }
  const display = Array.isArray(value) ? value.slice(0, 6).join(', ') : value;
  return (
    <div className="flex items-start gap-2">
      <span className={cn('text-sm w-24 flex-shrink-0', TEXT.muted)}>{label}</span>
      <span className={cn('text-sm flex-1', TEXT.primary)}>{display}</span>
      <span className="text-rose-600 text-xs">✓ Found</span>
    </div>
  );
}

export default function ExtractedFactsCard({ facts, phase }: Props) {
  if (!facts) {
    return (
      <div className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)}>
        <div className={cn('px-4 py-3 border-b', SURFACE.alt, BORDER.hairline)}>
          <h2 className={cn('font-medium text-sm', TEXT.primary)}>Extracted Facts</h2>
          <p className={cn('text-xs mt-0.5', TEXT.muted)}>Extracting business information...</p>
        </div>
        <div className={cn('p-4 text-center text-sm', TEXT.tertiary)}>
          Facts will appear as we crawl your website.
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)}>
      <div className={cn('px-4 py-3 border-b', SURFACE.alt, BORDER.hairline)}>
        <h2 className={cn('font-medium text-sm', TEXT.primary)}>Extracted Facts</h2>
        <p className={cn('text-xs mt-0.5', TEXT.muted)}>Identified from your existing website</p>
      </div>
      <div className="p-4 space-y-1.5">
        <FieldRow label="Business" value={facts.businessName} found={!!facts.businessName} />
        <FieldRow label="Industry" value={facts.industry} found={!!facts.industry} />
        <FieldRow label="Phone" value={facts.phone} found={!!facts.phone} />
        <FieldRow label="Email" value={facts.email} found={!!facts.email} />
        <FieldRow label="Address" value={facts.address} found={!!facts.address} />
        <FieldRow label="Services" value={facts.services} found={!!(facts.services && facts.services.length > 0)} />
        <FieldRow label="Service area" value={facts.serviceArea} found={!!facts.serviceArea} />
        <FieldRow label="Hours" value={facts.hours} found={!!(facts.hours && facts.hours.length > 0)} />
        <FieldRow label="Social links" value={facts.socialLinks} found={!!(facts.socialLinks && facts.socialLinks.length > 0)} />
        <FieldRow label="Booking" value={facts.bookingLinks} found={!!(facts.bookingLinks && facts.bookingLinks.length > 0)} />
      </div>
    </div>
  );
}
