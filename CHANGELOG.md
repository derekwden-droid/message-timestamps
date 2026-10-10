# Changelog

## 1.0.0 - 2026-10-10

- Mod that draws a dim time above each prompt and above the first block of each reply, in the
  terminal and the desktop app's Code tab.
- Times from when Claude Code stores a prompt and when a reply starts to appear, plus the session
  transcript's own times for messages from before the mod started (transcripts up to 4 MiB).
- Clock times in local time, with the date for other days; or relative times (`4m ago`) redrawn
  every minute.
- `/timestamps [clock | relative | off | on]`; the choice is remembered across sessions.
- Times kept per session in the plugin's storage, so resumed sessions show them; the 60 most
  recent sessions are kept.
