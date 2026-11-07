import assert from 'node:assert/strict';
import test from 'node:test';
import { latestCallUsageProjection as projection, reportedUsage } from './projection.js';
import { apply as activate } from './index.js';

const previous = { inputTokens: 1000, cacheReadTokens: 8000, outputTokens: 1000 };
const latest = { inputTokens: 3000, cacheReadTokens: 9000, outputTokens: 800 };
function message(seq, usage, extra = {}) {
  return { seq, type: 'assistant/message', time: seq * 1000, surfaceOp: 'append',
    data: { turn: 1, step: 1, usage, stream: [] }, ...extra };
}
function attempt(seq, samples) {
  return { seq, type: 'assistant/attempt', time: seq * 1000, data: { turn: 1, step: 1,
    stream: samples.map(usage => ({ type: 'chunk', time: seq * 1000, chunk: { type: 'usage', usage } })) } };
}
function replay(events, state = projection.init()) {
  for (const e of events) {
    const before = JSON.stringify(state);
    const next = projection.apply(state, e);
    assert.equal(JSON.stringify(state), before, 'projection must not mutate its previous state');
    state = next;
    projection.stateSchema.parse(state);
    projection.wire.viewSchema.parse(projection.wire.view(state));
  }
  return state;
}

test('latest completed call replaces the previous reading rather than accumulating it', () => {
  const { value } = replay([message(1, previous), message(2, latest)]);
  assert.equal(value.seq, 2);
  assert.equal(value.usage.inputTokens, 3000);
  assert.equal(value.usage.outputTokens, 800);
  assert.equal(value.usage.cacheReadTokens, 9000);
  assert.equal(value.usage.totalTokens, 12800);
  assert.equal(value.previousTotalTokens, 10000);
  assert.equal(value.cacheHitPercent, 75);
  assert.equal(value.cacheQualityPercent, 90);
});

test('in-progress requests, step/turn boundaries, live chunks and retries do not change the visible value', () => {
  const state = replay([message(1, previous), message(2, latest)]);
  for (const type of ['turn/start', 'turn/end', 'step/start', 'step/end', 'request/header',
    'request/context', 'llm/retry', 'llm/retry-started', 'agent/assistant-stream']) {
    const next = projection.apply(state, { seq: 3, time: 3000, type, data: { turn: 2, step: 1 } });
    assert.equal(next, state);
    assert.equal(projection.wire.view(next), state.value);
  }
});

test('before the first settled request, the plugin has no visible reading', () => {
  assert.equal(replay([{ seq: 1, type: 'step/start', time: 1000, data: { turn: 1, step: 1 } }]).value, null);
});

test('each retry settlement in the same step is a distinct request and only its last usage sample counts', () => {
  const state = replay([message(1, previous), attempt(2, [
    { inputTokens: 10, outputTokens: 1 },
    { inputTokens: 10, outputTokens: 90 },
  ]), message(3, latest)]);
  assert.equal(state.value.previousTotalTokens, 100);
  assert.equal(state.value.cacheQualityPercent, 9000);
  assert.equal(state.value.usage.totalTokens, 12800);
  const retry = replay([message(1, previous), attempt(2, [{ inputTokens: 10, outputTokens: 90 }])]);
  assert.equal(retry.value.usage.totalTokens, 100);
  assert.equal(retry.value.usage.outputTokens, 90);
});

test('first call and missing adjacent usage produce unavailable quality without skipping calls', () => {
  assert.equal(replay([message(1, previous)]).value.cacheQualityPercent, null);
  const missing = replay([message(1, previous), message(2, undefined)]);
  assert.equal(missing.value.seq, 2);
  assert.equal(missing.value.usage, null);
  assert.equal(missing.value.cacheHitPercent, null);
  assert.equal(missing.value.cacheQualityPercent, null);
  const next = replay([message(3, latest)], missing);
  assert.equal(next.value.previousTotalTokens, null);
  assert.equal(next.value.cacheQualityPercent, null);
});

test('zero denominator is unavailable; zero cache reads over a valid denominator is zero', () => {
  const zero = { inputTokens: 0, outputTokens: 0 };
  const noDenominator = replay([message(1, zero), message(2, latest)]).value;
  assert.equal(noDenominator.previousTotalTokens, 0);
  assert.equal(noDenominator.cacheQualityPercent, null);
  const noCache = replay([message(1, previous), message(2, { inputTokens: 100, outputTokens: 0 })]).value;
  assert.equal(noCache.cacheQualityPercent, 0);
  assert.equal(noCache.cacheHitPercent, 0);
});

test('cache writes contribute to both the hit denominator and previous total; reasoning is not double counted', () => {
  const usage = { inputTokens: 100, cacheReadTokens: 300, cacheWriteTokens: 100, outputTokens: 500, reasoningTokens: 400, totalTokens: 1000 };
  const state = replay([message(1, usage), message(2, { inputTokens: 0, cacheReadTokens: 1500, outputTokens: 0 })]);
  assert.equal(replay([message(1, usage)]).value.cacheHitPercent, 60);
  assert.equal(state.value.previousTotalTokens, 1000);
  assert.equal(state.value.cacheQualityPercent, 150);
});

test('a provider total is not substituted for the agreed sum of disjoint buckets', () => {
  assert.equal(reportedUsage(message(1, { ...previous, totalTokens: 999999 })).totalTokens, 10000);
});

test('top-level message usage takes precedence, with the final stream sample as fallback', () => {
  const e = message(1, latest);
  e.data.stream = attempt(1, [previous]).data.stream;
  assert.equal(reportedUsage(e).totalTokens, 12800);
  delete e.data.usage;
  assert.equal(reportedUsage(e).totalTokens, 10000);
});

test('completed cancellations and empty failed attempts advance the adjacent request boundary', () => {
  const cancelled = message(2, latest);
  cancelled.data.interrupted = true;
  const state = replay([message(1, previous), cancelled]);
  assert.equal(state.value.seq, 2);
  assert.equal(state.value.cacheQualityPercent, 90);
  const emptyAttempt = replay([attempt(3, [])], state);
  assert.equal(emptyAttempt.value.seq, 3);
  assert.equal(emptyAttempt.value.usage, null);
  assert.equal(replay([message(4, latest)], emptyAttempt).value.cacheQualityPercent, null);
});

test('surface rewrites, compaction and tools do not invent calls or disturb adjacency', () => {
  const state = replay([message(1, previous)]);
  const replacement = message(3, latest, { surfaceOp: { startSeq: 1, endSeq: 2 } });
  for (const e of [replacement, { seq: 4, type: 'compaction/summary', data: { usage: latest } },
    { seq: 5, type: 'tool/result', data: {} }]) {
    assert.equal(projection.apply(state, e), state);
  }
  assert.equal(replay([message(6, latest)], state).value.cacheQualityPercent, 90);
});

test('duplicate or older settlements cannot shift the previous-call denominator', () => {
  const state = replay([message(1, previous), message(2, latest)]);
  assert.equal(projection.apply(state, message(2, latest)), state);
  assert.equal(projection.apply(state, message(1, previous)), state);
});

test('JSON checkpoints and cross-turn replay retain the exact adjacent-call denominator', () => {
  const prefix = replay([message(1, previous)]);
  const checkpoint = projection.stateSchema.parse(JSON.parse(JSON.stringify(prefix)));
  const later = message(4, latest);
  later.data.turn = 2;
  later.data.step = 3;
  assert.deepEqual(replay([later], checkpoint), replay([message(1, previous), later]));
  assert.equal(replay([later], checkpoint).value.cacheQualityPercent, 90);
});

test('invalid billing buckets never produce invalid wire values', () => {
  for (const invalid of [
    { inputTokens: -1, outputTokens: 2 }, { inputTokens: 1, outputTokens: NaN },
    { inputTokens: 1.5, outputTokens: 2 }, { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 1 },
  ]) assert.equal(replay([message(1, invalid)]).value.usage, null);
});

test('Host activation awaits the independent, client-visible projection registration', async () => {
  let registered;
  await activate({ sessionProjections: { async register(definition) { registered = definition; } } });
  assert.equal(registered, projection);
  assert.equal(registered.wire.summary, false);
});
