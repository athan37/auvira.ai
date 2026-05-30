import type { Types } from 'mongoose';
import { AnalyticsEventBatch } from '@/models/AnalyticsEventBatch';
import { ComponentAnalyticsTotal } from '@/models/ComponentAnalyticsTotal';
import { ComponentAnalyticsWeekly } from '@/models/ComponentAnalyticsWeekly';
import type { IWebsiteAnalyticsConfig } from '@/models/WebsiteAnalyticsConfig';
import type { SanitizedAnalyticsPayload } from './validateAnalyticsPayload';

type AggregateModel = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>
  ) => Promise<any> | { select: (fields: string) => Promise<any> };
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>
  ) => Promise<unknown>;
};

export interface AnalyticsAggregationModels {
  eventBatch: { create: (doc: Record<string, unknown>) => Promise<unknown> };
  weekly: AggregateModel;
  total: AggregateModel;
}

export interface RecordAnalyticsBatchInput {
  config: IWebsiteAnalyticsConfig;
  payload: SanitizedAnalyticsPayload;
  models?: AnalyticsAggregationModels;
}

export interface RecordAnalyticsBatchResult {
  eventCount: number;
}

function weekStartUtc(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return start;
}

function eventIncrements(event: SanitizedAnalyticsPayload['events'][number]) {
  return {
    impressions: event.type === 'view' ? 1 : 0,
    focusMs: event.type === 'focus' ? event.durationMs ?? 0 : 0,
    clicks: event.type === 'click' ? 1 : 0,
  };
}

async function awaitUpdatedDoc(query: Promise<any> | { select: (fields: string) => Promise<any> }) {
  if (query && typeof (query as { select?: unknown }).select === 'function') {
    return (query as { select: (fields: string) => Promise<any> }).select('+sessionHashes');
  }
  return query;
}

async function updateAggregate(input: {
  model: AggregateModel;
  filter: Record<string, unknown>;
  projectId: Types.ObjectId;
  ownerId: Types.ObjectId;
  event: SanitizedAnalyticsPayload['events'][number];
  sessionIdHash?: string;
  weekStart?: Date;
}) {
  const increments = eventIncrements(input.event);
  const update: Record<string, unknown> = {
    $setOnInsert: {
      projectId: input.projectId,
      ownerId: input.ownerId,
      ...(input.weekStart ? { weekStart: input.weekStart } : {}),
      componentId: input.event.componentId,
    },
    $set: {
      componentType: input.event.componentType,
      componentLabel: input.event.componentLabel,
    },
    $inc: increments,
  };

  if (input.sessionIdHash) {
    update.$addToSet = { sessionHashes: input.sessionIdHash };
  }

  const doc = await awaitUpdatedDoc(
    input.model.findOneAndUpdate(input.filter, update, { upsert: true, new: true })
  );

  if (doc?.sessionHashes && Array.isArray(doc.sessionHashes)) {
    await input.model.updateOne(input.filter, {
      $set: { uniqueSessions: doc.sessionHashes.length },
    });
  }
}

export async function recordAnalyticsBatch(
  input: RecordAnalyticsBatchInput
): Promise<RecordAnalyticsBatchResult> {
  const models = input.models ?? {
    eventBatch: AnalyticsEventBatch,
    weekly: ComponentAnalyticsWeekly,
    total: ComponentAnalyticsTotal,
  };

  await models.eventBatch.create({
    projectId: input.config.projectId,
    ownerId: input.config.ownerId,
    publicSiteKey: input.payload.publicSiteKey,
    visitorIdHash: input.payload.visitorIdHash,
    sessionIdHash: input.payload.sessionIdHash,
    userAgentHash: input.payload.userAgentHash,
    pagePath: input.payload.pagePath,
    pageOrigin: input.payload.pageOrigin,
    referrerOrigin: input.payload.referrerOrigin,
    events: input.payload.events,
    receivedAt: new Date(),
  });

  for (const event of input.payload.events) {
    const weeklyFilter = {
      projectId: input.config.projectId,
      weekStart: weekStartUtc(event.occurredAt),
      componentId: event.componentId,
    };
    const totalFilter = {
      projectId: input.config.projectId,
      componentId: event.componentId,
    };

    await updateAggregate({
      model: models.weekly,
      filter: weeklyFilter,
      projectId: input.config.projectId,
      ownerId: input.config.ownerId,
      event,
      sessionIdHash: input.payload.sessionIdHash,
      weekStart: weeklyFilter.weekStart,
    });

    await updateAggregate({
      model: models.total,
      filter: totalFilter,
      projectId: input.config.projectId,
      ownerId: input.config.ownerId,
      event,
      sessionIdHash: input.payload.sessionIdHash,
    });
  }

  return { eventCount: input.payload.events.length };
}
