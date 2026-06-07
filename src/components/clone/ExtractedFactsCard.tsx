'use client';

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
        <span className="text-zinc-500 text-sm w-24 flex-shrink-0">{label}</span>
        <span className="text-xs text-zinc-400 italic flex-1">{missingText}</span>
        <span className="text-xs text-zinc-400">—</span>
      </div>
    );
  }
  const display = Array.isArray(value) ? value.slice(0, 6).join(', ') : value;
  return (
    <div className="flex items-start gap-2">
      <span className="text-zinc-500 text-sm w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-zinc-800 flex-1">{display}</span>
      <span className="text-green-500 text-xs">✓ Found</span>
    </div>
  );
}

export default function ExtractedFactsCard({ facts, phase }: Props) {
  const isExtracting = phase === 'crawling' || phase === 'extracting';

  if (!facts) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
          <h2 className="font-medium text-zinc-800 text-sm">Extracted Facts</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Extracting business information...</p>
        </div>
        <div className="p-4 text-center text-zinc-400 text-sm">
          Facts will appear as we crawl your website.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
        <h2 className="font-medium text-zinc-800 text-sm">Extracted Facts</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Identified from your existing website</p>
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