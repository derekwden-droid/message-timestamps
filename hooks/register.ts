// timestamps: draws the time above each prompt you send and each reply Claude starts, in the
// terminal and in the desktop app's Code tab.
//
// Where the times come from:
// - your prompts: the moment the session stores the row (session.append), filed by its uuid,
//   which is also the row's render id;
// - Claude's replies: the moment a reply's first block is drawn while a turn runs, filed by the
//   reply's message id;
// - rows from before the mod loaded: the session transcript, read once (up to 4 MiB).
// Every time is kept in $.store per session, so a resumed session shows them again.

import type { Register } from 'claude-code'
import {
  label,
  MODES,
  nextMode,
  READ_LIMIT,
  rowKey,
  sessionsToDrop,
  timesFromTranscript,
  trimTimes,
} from './time.mjs'

const SETTINGS = 'settings'
const SESSION_PREFIX = 'session:'
const RELATIVE_TICK_MS = 60000
const SAVE_DELAY_MS = 1500

type Settings = { mode: string; lastShown: string }

let sessionId = ''
let times: Record<string, number> = {}
let settings: Settings = { mode: 'clock', lastShown: 'clock' }
let turnActive = false
let historyRead = false
let saveTimer: (() => void) | null = null
let tick: (() => void) | null = null
const offsetMin = -new Date().getTimezoneOffset()

async function load($: any) {
  sessionId = await $.session.id()
  const saved = (await $.store.get(SETTINGS)) as Settings | undefined
  if (saved && MODES.includes(saved.mode)) settings = saved
  const kept = (await $.store.get(SESSION_PREFIX + sessionId)) as { t?: Record<string, number> } | undefined
  times = { ...(kept && kept.t ? kept.t : {}), ...times }
}

async function prune($: any) {
  const keys = ((await $.store.keys()) as string[]).filter(k => k.startsWith(SESSION_PREFIX))
  const sessions = []
  for (const key of keys) {
    const v = (await $.store.get(key)) as { at?: number } | undefined
    sessions.push({ key, at: v && typeof v.at === 'number' ? v.at : 0 })
  }
  for (const key of sessionsToDrop(sessions)) await $.store.delete(key)
}

async function persist($: any) {
  saveTimer = null
  times = trimTimes(times)
  await $.store.set(SESSION_PREFIX + sessionId, { at: await $.clock.now(), t: times })
}

function save($: any) {
  if (saveTimer || !sessionId) return
  saveTimer = $.clock.after(SAVE_DELAY_MS, () => persist($))
}

function stamp($: any, key: string, at: number) {
  if (!key || times[key] !== undefined) return false
  times[key] = at
  save($)
  return true
}

// The transcript's own times for rows drawn before the mod loaded.
async function readHistory($: any, path: unknown) {
  if (historyRead || typeof path !== 'string' || !path) return
  historyRead = true
  try {
    const st = await $.fs.stat(path)
    if (st.size > READ_LIMIT) return
    const found = timesFromTranscript(await $.fs.read(path))
    let added = 0
    for (const [key, at] of Object.entries(found)) if (stamp($, key, at as number)) added++
    if (added) $.ui.invalidate('ui.render')
  } catch {
    // An unreadable transcript leaves the earlier rows without times.
  }
}

function startTicking($: any) {
  if (tick) tick()
  tick = settings.mode === 'relative' ? $.clock.every(RELATIVE_TICK_MS, () => $.ui.invalidate('ui.render')) : null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await load($)
    await $.command.register({
      name: 'timestamps',
      description: 'Show message times: /timestamps [clock | relative | off | on]',
    })
    startTicking($)
    await prune($)
    return next(e)
  })

  // The settings hooks' events carry the transcript's path; the first one seen reads it.
  on('classic.SessionStart', async ($, e, next) => {
    await readHistory($, e.transcript_path)
    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.UserPromptSubmit', async ($, e, next) => {
    await readHistory($, e.transcript_path)
    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.PreToolUse', async ($, e, next) => {
    await readHistory($, e.transcript_path)
    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.Stop', async ($, e, next) => {
    await readHistory($, e.transcript_path)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    turnActive = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    turnActive = false
    return next(e)
  })

  on('session.append', async ($, e, next) => {
    const result = await next(e)
    if (e.message.type === 'user' && !e.message.isMeta && e.door === 'prompt' && !e.agentId) {
      if (stamp($, e.uuid, await $.clock.now())) $.ui.invalidate('ui.render')
    }
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'timestamps' }, async ($, e) => {
    const mode = nextMode(e.args, settings.mode, settings.lastShown)
    if (!mode) return { text: 'Usage: /timestamps [clock | relative | off | on]. Now: ' + settings.mode + '.' }
    settings = { mode, lastShown: mode === 'off' ? settings.lastShown : mode }
    await $.store.set(SETTINGS, settings)
    startTicking($)
    $.ui.invalidate('ui.render')
    const what = mode === 'off' ? 'off' : mode === 'relative' ? 'on, as time since each message' : 'on, as clock times'
    return { text: 'Message times are ' + what + '.' }
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    if (settings.mode === 'off') return drawn
    const at = times[rowKey(e.requestId)]
    if (at === undefined) return drawn
    const { Box, Text } = $.ui.resolve(e)
    const text = label(at, await $.clock.now(), settings.mode, offsetMin)
    return Box({ flexDirection: 'column', children: [Text({ dimColor: true, children: [text] }), drawn] })
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    if (settings.mode === 'off' || !e.props.isFirstOfReply) return drawn
    const key = rowKey(e.requestId)
    const now = await $.clock.now()
    if (times[key] === undefined && turnActive) stamp($, key, now)
    const at = times[key]
    if (at === undefined) return drawn
    const { Box, Text } = $.ui.resolve(e)
    return Box({ flexDirection: 'column', children: [Text({ dimColor: true, children: [label(at, now, settings.mode, offsetMin)] }), drawn] })
  })
}
