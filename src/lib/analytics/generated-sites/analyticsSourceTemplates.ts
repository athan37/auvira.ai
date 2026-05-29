import { DEFAULT_ANALYTICS_COLLECT_PATH } from './analyticsConstants';

export interface AnalyticsSourceTemplateInput {
  publicSiteKey: string;
  collectEndpoint?: string;
  enabled?: boolean;
}

function serializeString(value: string): string {
  return JSON.stringify(value);
}

export function generateAnalyticsConfigSource(input: AnalyticsSourceTemplateInput): string {
  const collectEndpoint = input.collectEndpoint ?? DEFAULT_ANALYTICS_COLLECT_PATH;
  const enabled = Boolean(input.enabled ?? (input.publicSiteKey && collectEndpoint));

  return `export const websiteAnalyticsConfig = {
  enabled: ${enabled ? 'true' : 'false'},
  publicSiteKey: ${serializeString(input.publicSiteKey)},
  collectEndpoint: ${serializeString(collectEndpoint)},
} as const;
`;
}

export function generateAnalyticsAttrsSource(): string {
  return `export type AnalyticsAttrsInput = {
  id?: string;
  type: 'hero' | 'section' | 'cta';
  label?: string;
};

export function analyticsAttrs(input: AnalyticsAttrsInput) {
  if (!input.id) return {};
  return {
    'data-analytics-id': input.id,
    'data-analytics-type': input.type,
    'data-analytics-label': input.label || input.id,
  };
}
`;
}

export function generateWebsiteAnalyticsSource(): string {
  return `"use client";

import { useEffect } from 'react';
import { websiteAnalyticsConfig } from '@/lib/analyticsConfig';

type AnalyticsEventType = 'view' | 'focus' | 'click';

type AnalyticsEvent = {
  type: AnalyticsEventType;
  componentId: string;
  componentType: string;
  componentLabel?: string;
  durationMs?: number;
  visibleRatio?: number;
  occurredAt: string;
};

const FOCUS_THRESHOLD = 0.5;
const FLUSH_INTERVAL_MS = 10000;
const MAX_BATCH_SIZE = 30;

function safeStorageId(storage: Storage | undefined, key: string): string {
  if (!storage) return Math.random().toString(36).slice(2);
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    storage.setItem(key, next);
    return next;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function elementEventBase(element: Element): Omit<AnalyticsEvent, 'type' | 'occurredAt'> | null {
  const componentId = element.getAttribute('data-analytics-id');
  if (!componentId) return null;
  return {
    componentId,
    componentType: element.getAttribute('data-analytics-type') || 'section',
    componentLabel: element.getAttribute('data-analytics-label') || undefined,
  };
}

export function WebsiteAnalytics() {
  useEffect(() => {
    if (!websiteAnalyticsConfig.enabled || !websiteAnalyticsConfig.publicSiteKey || !websiteAnalyticsConfig.collectEndpoint) {
      return;
    }

    try {
      const trackedElements = Array.from(document.querySelectorAll('[data-analytics-id]'));
      if (trackedElements.length === 0) return;

      const visitorId = safeStorageId(window.localStorage, 'website_analytics_visitor_id');
      const sessionId = safeStorageId(window.sessionStorage, 'website_analytics_session_id');
      const queue: AnalyticsEvent[] = [];
      const seenViews = new Set<string>();
      const visibleSince = new Map<string, number>();
      const latestRatio = new Map<string, number>();

      const enqueue = (event: AnalyticsEvent) => {
        queue.push(event);
        if (queue.length >= MAX_BATCH_SIZE) {
          flush();
        }
      };

      const stopFocus = (componentId: string) => {
        const startedAt = visibleSince.get(componentId);
        if (!startedAt) return;
        visibleSince.delete(componentId);
        const element = trackedElements.find((candidate) => candidate.getAttribute('data-analytics-id') === componentId);
        if (!element) return;
        const base = elementEventBase(element);
        if (!base) return;
        const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
        if (durationMs < 100) return;
        enqueue({
          ...base,
          type: 'focus',
          durationMs,
          visibleRatio: latestRatio.get(componentId) ?? FOCUS_THRESHOLD,
          occurredAt: new Date().toISOString(),
        });
      };

      function flush() {
        if (queue.length === 0) return;
        const events = queue.splice(0, queue.length);
        const payload = JSON.stringify({
          publicSiteKey: websiteAnalyticsConfig.publicSiteKey,
          visitorId,
          sessionId,
          pageUrl: window.location.href,
          referrer: document.referrer || undefined,
          events,
        });

        try {
          if (navigator.sendBeacon) {
            const sent = navigator.sendBeacon(
              websiteAnalyticsConfig.collectEndpoint,
              new Blob([payload], { type: 'application/json' })
            );
            if (sent) return;
          }
          void fetch(websiteAnalyticsConfig.collectEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        } catch {
          /* Analytics must never affect rendering. */
        }
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (document.hidden) return;
          for (const entry of entries) {
            const base = elementEventBase(entry.target);
            if (!base) continue;
            latestRatio.set(base.componentId, entry.intersectionRatio);
            if (entry.isIntersecting && entry.intersectionRatio >= FOCUS_THRESHOLD) {
              if (!seenViews.has(base.componentId)) {
                seenViews.add(base.componentId);
                enqueue({
                  ...base,
                  type: 'view',
                  visibleRatio: entry.intersectionRatio,
                  occurredAt: new Date().toISOString(),
                });
              }
              if (!visibleSince.has(base.componentId)) {
                visibleSince.set(base.componentId, performance.now());
              }
            } else {
              stopFocus(base.componentId);
            }
          }
        },
        { threshold: [0, FOCUS_THRESHOLD, 0.75, 1] }
      );

      trackedElements.forEach((element) => observer.observe(element));

      const handleClick = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target.closest('[data-analytics-id]') : null;
        if (!target || target.getAttribute('data-analytics-type') !== 'cta') return;
        const base = elementEventBase(target);
        if (!base) return;
        enqueue({ ...base, type: 'click', occurredAt: new Date().toISOString() });
      };

      const handleVisibility = () => {
        if (document.hidden) {
          Array.from(visibleSince.keys()).forEach(stopFocus);
          flush();
        } else {
          const now = performance.now();
          trackedElements.forEach((element) => {
            const id = element.getAttribute('data-analytics-id');
            if (id && (latestRatio.get(id) ?? 0) >= FOCUS_THRESHOLD) {
              visibleSince.set(id, now);
            }
          });
        }
      };

      const interval = window.setInterval(flush, FLUSH_INTERVAL_MS);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('pagehide', flush);

      return () => {
        Array.from(visibleSince.keys()).forEach(stopFocus);
        flush();
        observer.disconnect();
        window.clearInterval(interval);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', flush);
      };
    } catch {
      return;
    }
  }, []);

  return null;
}
`;
}
