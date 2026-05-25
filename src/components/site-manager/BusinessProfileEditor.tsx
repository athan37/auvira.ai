'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SITE_MANAGER_COPY } from '@/lib/owner/ownerCopy';

export interface BusinessProfileFormData {
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  mainServices?: string[];
}

interface Props {
  initial: BusinessProfileFormData;
  onSave: (data: BusinessProfileFormData) => Promise<void>;
  onConfirm: (data: BusinessProfileFormData) => Promise<void>;
  saving?: boolean;
}

export function BusinessProfileEditor({ initial, onSave, onConfirm, saving }: Props) {
  const [form, setForm] = useState<BusinessProfileFormData>({
    businessName: initial.businessName ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    address: initial.address ?? '',
    hours: initial.hours ?? '',
    mainServices: initial.mainServices?.length ? initial.mainServices : [''],
  });

  const submit = { ...form, mainServices: form.mainServices?.filter(Boolean) };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-zinc-600">Confirm the details we should keep correct on your live website.</p>
      <Input placeholder="Business name" value={form.businessName ?? ''} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
      <Input placeholder="Phone number" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Input placeholder="Email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Input placeholder="Address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <Input placeholder="Business hours" value={form.hours ?? ''} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
      <Input
        placeholder="Main service"
        value={form.mainServices?.[0] ?? ''}
        onChange={(e) => setForm({ ...form, mainServices: e.target.value ? [e.target.value] : [] })}
      />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => onSave(submit)}>
          Save draft
        </Button>
        <Button type="button" size="sm" disabled={saving || !form.phone?.trim()} onClick={() => onConfirm(submit)}>
          {SITE_MANAGER_COPY.confirmDetails}
        </Button>
      </div>
    </div>
  );
}
