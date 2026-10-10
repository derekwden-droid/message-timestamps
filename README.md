# message-timestamps

Claude Code shows no times on messages. In a long session you can't tell when you gave an instruction, how long ago a background job last reported, or how a reply lines up with a log or a deploy. This is open on Anthropic's tracker as anthropics/claude-code 44763, with over 100 votes and new ones in October 2026.

message-timestamps is a mod: a plugin that draws inside Claude Code's own interface. It puts a small dim time above each prompt you send and above the start of each reply from Claude:

```
12:05
> deploy the staging branch

12:05
* Deploying staging now. The build takes about four minutes...

12:41
> did it finish?
```

Messages from another day show the date too (`Oct 9 12:05`). Switch to relative times (`4m ago`, `3h ago`) with `/timestamps relative`; they update every minute.

## Try it

1. Install it, then send any prompt: the time appears above your message and above Claude's reply.
2. Run `/timestamps relative`, then come back in a few minutes: the times now read `just now`, `3m ago`.
3. Run `/timestamps off` to hide them, and `/timestamps` again to bring them back.

## The /timestamps command

| Command | What it does |
| - | - |
| `/timestamps` | Turns times off, or back on in the last style you used |
| `/timestamps clock` | Clock times, such as `14:32` |
| `/timestamps relative` | Time since, such as `4m ago` |
| `/timestamps off` / `on` | Hides or shows them |

Your choice is remembered across sessions.

## Where the times come from

- **Your prompts:** the moment Claude Code stores the prompt.
- **Claude's replies:** the moment a reply starts to appear.
- **Messages from before the mod was running**, such as a session you resume: the times in the session's transcript, which Claude Code records for every message.

Every time the mod records is kept with the session, so a resumed session shows its times again.

## What's included

- **One hooks module** (`hooks/register.ts`, with `hooks/time.mjs`). It runs inside Claude Code as a mod: it draws the time above message rows, records times as messages arrive, reads the session transcript once, and adds the `/timestamps` command.

## What it reads, writes, runs and sends

- **Reads** the current session's transcript once, to find the times of messages from before it started. It reads no other files.
- **Writes** nothing to disk itself. It keeps the times it records, and your `/timestamps` choice, in the plugin's own storage in Claude Code: one table per session, for the 60 most recent sessions.
- **Runs** no programs.
- **Sends** nothing over the network. There is no telemetry and no account. See [PRIVACY.md](PRIVACY.md).

## Limits

- Mods draw in the Claude Code terminal app and the desktop app's Code tab. They don't draw in the VS Code extension yet, so no times appear there.
- Claude Code lets a mod read files up to 4 MiB. A long session's transcript can be bigger, and then messages from before the mod started that session show no time. Everything after that does.
- A reply's time is taken when it starts to appear on screen, within a second or two of when Claude started writing it.
- A tool call's row has no time of its own; the time above the reply that made it covers it.

## Requirements

- Claude Code 2.1.287 or later in the terminal, or the desktop app with Claude Code 2.1.286 or later, with mods on (they are by default). Tested on Claude Code 2.1.295 in the desktop app's Code tab on Windows 11.

## Development

`node --test` runs the tests of `hooks/time.mjs`, which need nothing beyond Node. `claude plugin validate .` checks the hooks module the way Claude Code loads it.

## License

MIT. See [LICENSE](LICENSE).
