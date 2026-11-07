import { z } from 'zod';

export const PROJECTION_KEY = 'localLatestCallUsage';
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sampleSchema = z.object({
  inputTokens: count,
  outputTokens: count,
  cacheReadTokens: count,
  cacheWriteTokens: count,
}).strict();
const usageSchema = sampleSchema.extend({ totalTokens: count }).strict();
const percent = z.number().nonnegative().nullable();
const readingSchema = z.object({
  seq: count,
  usage: usageSchema.nullable(),
  previousTotalTokens: count.nullable(),
  cacheHitPercent: percent,
  cacheQualityPercent: percent,
}).strict();
const stateSchema = z.object({ value: readingSchema.nullable() }).strict();

/** Read the same final billing sample as DSH's tokenUsage projection. */
export function reportedUsage(event) {
  let usage = event.type === 'assistant/message' ? event.data.usage : undefined;
  if (usage === undefined) {
    const stream = event.data.stream ?? [];
    for (let i = stream.length - 1; i >= 0; i--) {
      if (stream[i].type === 'chunk' && stream[i].chunk.type === 'usage') {
        usage = stream[i].chunk.usage;
        break;
      }
    }
  }
  if (usage === undefined || usage === null) return null;
  // DSH inputTokens is uncached input. The cache buckets are disjoint.
  const parsed = sampleSchema.safeParse({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  });
  if (!parsed.success) return null;
  const sample = parsed.data;
  const totalTokens = sample.inputTokens + sample.cacheReadTokens + sample.cacheWriteTokens + sample.outputTokens;
  if (!Number.isSafeInteger(totalTokens)) return null;
  return { ...sample, totalTokens };
}

/**
 * Each durable Assistant settlement ends one actual request, including retries.
 * Step and Turn boundaries are not request boundaries. In-flight events leave
 * the last settled reading unchanged, so the UI needs no stream subscriptions.
 */
export function foldLatestCall(state, event) {
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return state;
  // Surface rewrites from compaction/import do not represent new model calls.
  if (event.type === 'assistant/message' && event.surfaceOp !== 'append') return state;
  if (state.value !== null && event.seq <= state.value.seq) return state;
  const usage = reportedUsage(event);
  // Do not skip an adjacent request with missing usage to find a nicer denominator.
  const previousTotalTokens = state.value?.usage?.totalTokens ?? null;
  const input = usage === null ? 0 : usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  return { value: {
    seq: event.seq,
    usage,
    previousTotalTokens,
    cacheHitPercent: usage !== null && input > 0 ? usage.cacheReadTokens / input * 100 : null,
    cacheQualityPercent: usage !== null && previousTotalTokens !== null && previousTotalTokens > 0
      ? usage.cacheReadTokens / previousTotalTokens * 100 : null,
  } };
}

export const latestCallUsageProjection = {
  key: PROJECTION_KEY,
  stateVersion: 2,
  stateSchema,
  init: () => ({ value: null }),
  apply: foldLatestCall,
  wire: { viewSchema: readingSchema.nullable(), view: state => state.value, summary: false },
};
