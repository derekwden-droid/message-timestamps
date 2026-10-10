// Tests for hooks/time.mjs, the part of the mod that needs no engine: reading times out of a
// transcript, formatting them, the /timestamps argument, and keeping the stored tables small.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClock,
  formatRelative,
  label,
  nextMode,
  rowKey,
  sessionsToDrop,
  timesFromTranscript,
  trimTimes,
} from '../hooks/time.mjs';

const at = (iso) => Date.parse(iso);
const row = (o) => JSON.stringify(o);

test('files a user row by uuid and an assistant row by message id', () => {
  assert.equal(rowKey('81355756-a160-44c0-8efd-318a5c1158dc'), '81355756-a160-44c0-8efd-318a5c1158dc');
  assert.equal(rowKey('msg_011Cftq5JSG3FZZKqTqSD3m7-t0'), 'msg_011Cftq5JSG3FZZKqTqSD3m7');
  assert.equal(rowKey('msg_abc-t12'), 'msg_abc');
  assert.equal(rowKey(undefined), '');
});

test('reads prompt and reply times from a transcript', () => {
  const text = [
    row({ type: 'user', uuid: 'u1', timestamp: '2026-10-10T16:05:00.000Z', message: { role: 'user', content: 'go' } }),
    row({ type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-10T16:05:01.000Z', message: { content: 'reminder' } }),
    row({ type: 'assistant', uuid: 'a1', timestamp: '2026-10-10T16:05:09.000Z', message: { id: 'msg_1', content: [{ type: 'thinking' }] } }),
    row({ type: 'assistant', uuid: 'a2', timestamp: '2026-10-10T16:05:07.000Z', message: { id: 'msg_1', content: [{ type: 'text', text: 'hi' }] } }),
    row({ type: 'attachment', uuid: 'x', timestamp: '2026-10-10T16:05:02.000Z' }),
    row({ type: 'user', uuid: 'u3', timestamp: 'not a date' }),
    'not json "timestamp"',
    '',
  ].join('\n');
  assert.deepEqual(timesFromTranscript(text), {
    u1: at('2026-10-10T16:05:00.000Z'),
    msg_1: at('2026-10-10T16:05:07.000Z'),
  });
  assert.deepEqual(timesFromTranscript(''), {});
});

test('draws clock times in local time, with the day when it is not today', () => {
  const now = at('2026-10-10T18:00:00Z');
  assert.equal(formatClock(at('2026-10-10T16:05:00Z'), now, -240), '12:05');
  assert.equal(formatClock(at('2026-10-10T16:05:00Z'), now, 0), '16:05');
  assert.equal(formatClock(at('2026-10-09T16:05:00Z'), now, -240), 'Oct 9 12:05');
  assert.equal(formatClock(at('2025-12-31T23:59:00Z'), now, 0), 'Dec 31 2025 23:59');
  assert.equal(formatClock(at('2026-10-11T02:30:00Z'), at('2026-10-11T03:00:00Z'), -240), '22:30');
  assert.equal(formatClock(at('2026-10-10T20:30:00Z'), at('2026-10-10T21:00:00Z'), 330), '02:00');
});

test('draws relative times', () => {
  const now = at('2026-10-10T18:00:00Z');
  assert.equal(formatRelative(now - 10000, now), 'just now');
  assert.equal(formatRelative(now + 5000, now), 'just now');
  assert.equal(formatRelative(now - 4 * 60000, now), '4m ago');
  assert.equal(formatRelative(now - 3 * 3600000, now), '3h ago');
  assert.equal(formatRelative(now - 3 * 86400000, now), '3d ago');
  assert.equal(label(now - 4 * 60000, now, 'relative'), '4m ago');
  assert.equal(label(at('2026-10-10T16:05:00Z'), now, 'clock', 0), '16:05');
});

test('reads the /timestamps argument', () => {
  assert.equal(nextMode('', 'clock', 'clock'), 'off');
  assert.equal(nextMode('', 'off', 'relative'), 'relative');
  assert.equal(nextMode('', 'off', 'off'), 'clock');
  assert.equal(nextMode('on', 'off', 'relative'), 'relative');
  assert.equal(nextMode('on', 'clock', 'clock'), 'clock');
  assert.equal(nextMode(' Relative ', 'clock', 'clock'), 'relative');
  assert.equal(nextMode('off', 'relative', 'relative'), 'off');
  assert.equal(nextMode('loud', 'clock', 'clock'), null);
});

test('keeps the stored tables small', () => {
  const times = { a: 1, b: 2, c: 3, d: 4 };
  assert.deepEqual(trimTimes(times, 2), { c: 3, d: 4 });
  assert.equal(trimTimes(times, 10), times);
  assert.deepEqual(trimTimes(undefined), {});
  const sessions = [{ key: 's1', at: 10 }, { key: 's2', at: 30 }, { key: 's3', at: 20 }];
  assert.deepEqual(sessionsToDrop(sessions, 2), ['s1']);
  assert.deepEqual(sessionsToDrop(sessions, 5), []);
});
