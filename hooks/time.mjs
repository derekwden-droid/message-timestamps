// The parts of timestamps that need no engine: reading times out of a session transcript,
// formatting them, and keeping the stored tables small. register.ts calls these; the tests run
// them under plain Node.

export const MODES = ['clock', 'relative', 'off'];
export const KEEP_SESSIONS = 60;
export const KEEP_PER_SESSION = 4000;
export const READ_LIMIT = 4 * 1024 * 1024;

// The key a message row is filed under. A user row's render id is its transcript uuid; an
// assistant row's is the API message id with a block suffix (msg_x-t0, msg_x-t1), and every block
// of one reply shares the reply's time.
export function rowKey(requestId) {
  return String(requestId || '').replace(/-t\d+$/, '');
}

// Times by row key from a transcript's JSONL text: user prompts by uuid, assistant replies by
// API message id (the first row of a reply wins). Rows without a timestamp are skipped.
export function timesFromTranscript(text) {
  const times = {};
  for (const line of String(text || '').split('\n')) {
    if (!line.includes('"timestamp"')) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const at = Date.parse(row && row.timestamp);
    if (!Number.isFinite(at)) continue;
    if (row.type === 'user' && typeof row.uuid === 'string' && !row.isMeta) {
      if (times[row.uuid] === undefined) times[row.uuid] = at;
    } else if (row.type === 'assistant' && row.message && typeof row.message.id === 'string') {
      const id = row.message.id;
      if (times[id] === undefined || at < times[id]) times[id] = at;
    }
  }
  return times;
}

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Local wall-clock time: "14:32" today, "Oct 9 14:32" on another day, with the year when it
// isn't this year. `offsetMin` is minutes east of UTC, so a sandbox that only knows UTC can
// still draw local time.
export function formatClock(at, now, offsetMin = 0) {
  const shift = offsetMin * 60000;
  const d = new Date(at + shift);
  const n = new Date(now + shift);
  const hm = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  const sameDay = d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
  if (sameDay) return hm;
  const day = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  return (d.getUTCFullYear() === n.getUTCFullYear() ? day : day + ' ' + d.getUTCFullYear()) + ' ' + hm;
}

// "just now", "4m ago", "3h ago", "2d ago".
export function formatRelative(at, now) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 36) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

export function label(at, now, mode, offsetMin = 0) {
  if (mode === 'relative') return formatRelative(at, now);
  return formatClock(at, now, offsetMin);
}

// The /timestamps argument: a mode, "on" (back to the last shown mode, or clock), or nothing
// (a toggle between off and the last shown mode). Returns the new mode, or null when the
// argument names nothing.
export function nextMode(args, current, lastShown) {
  const a = String(args || '').trim().toLowerCase();
  const shown = MODES.includes(lastShown) && lastShown !== 'off' ? lastShown : 'clock';
  if (a === '') return current === 'off' ? shown : 'off';
  if (a === 'on') return current === 'off' ? shown : current;
  if (MODES.includes(a)) return a;
  return null;
}

// A session's table trimmed to its newest KEEP_PER_SESSION entries.
export function trimTimes(times, keep = KEEP_PER_SESSION) {
  const entries = Object.entries(times || {});
  if (entries.length <= keep) return times || {};
  entries.sort((a, b) => a[1] - b[1]);
  return Object.fromEntries(entries.slice(-keep));
}

// Which stored sessions to drop: all but the KEEP_SESSIONS most recently used.
// `sessions` is [{ key, at }].
export function sessionsToDrop(sessions, keep = KEEP_SESSIONS) {
  return [...sessions].sort((a, b) => b.at - a.at).slice(keep).map((s) => s.key);
}
