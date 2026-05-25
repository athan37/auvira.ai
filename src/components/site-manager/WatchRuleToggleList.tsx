'use client';

import { SITE_MANAGER_COPY } from '@/lib/owner/ownerCopy';

export interface WatchMonitorItem {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  lastResult?: string | null;
}

interface Props {
  monitors: WatchMonitorItem[];
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  disabled?: boolean;
}

export function WatchRuleToggleList({ monitors, onToggle, disabled }: Props) {
  if (!monitors.length) {
    return <p className="text-sm text-zinc-500">Confirm your business details to see what we can check.</p>;
  }
  return (
    <ul className="space-y-2">
      {monitors.map((m) => (
        <li key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <div>
            <p className="text-sm font-medium">{m.label}</p>
            <p className="text-xs text-zinc-500">{SITE_MANAGER_COPY.weCheckThis}</p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={m.enabled}
              disabled={disabled}
              onChange={(e) => onToggle(m.id, e.target.checked)}
            />
            On
          </label>
        </li>
      ))}
    </ul>
  );
}
