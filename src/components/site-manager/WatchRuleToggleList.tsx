'use client';

import { BORDER, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';
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
    return <p className={cn('text-sm', TEXT.muted)}>Confirm your business details to see what we can check.</p>;
  }
  return (
    <ul className="space-y-2">
      {monitors.map((m) => (
        <li
          key={m.id}
          className={cn(
            'flex items-center justify-between rounded-lg border bg-white px-3 py-2',
            BORDER.hairline
          )}
        >
          <div>
            <p className="text-sm font-medium">{m.label}</p>
            <p className={cn('text-xs', TEXT.muted)}>{SITE_MANAGER_COPY.weCheckThis}</p>
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
