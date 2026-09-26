# today-mod

> `/today` for Claude Code: your calendar, E3 deadlines and Reminders in one line above the prompt, and in Claude's context, so it knows your day before you say a word.

`claude-code` · `mod` · `function-hooks` · `macos` · `nycu` · `agenda`

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-mod-d97757)](https://github.com/zyx1121/today-mod) &nbsp;[![CI](https://github.com/zyx1121/today-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/zyx1121/today-mod/actions/workflows/ci.yml) &nbsp;[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

```
📅 13:20 3D遊戲程式 · ED102 · in 3h 20m  📝 1 due (1 within 3d)  ☑ 1 overdue
```
<sub>The band directly above the prompt: the running or next event with a countdown, deadlines ahead, reminders due. It ticks every minute and re-reads every five, one read shared by every open session.</sub>

Sessions start with "what was I supposed to do today?" and end with a missed class. This mod reads the day once at start, keeps the next thing in view, and hands the whole agenda to Claude as a context block, so "do I have time for this before class?" gets a real answer.

It is a Claude Code **mod**: a plugin whose behaviour lives in a TypeScript hooks module. The data comes from three [zyx utils](https://github.com/zyx1121/plugin) scripts run as child processes (`calendar.py`, `reminders.py`, `e3p.py`), nothing else.

## Install

Function hooks are early access, so the engine loads a mod only with the flag on. Put it in your shell profile or in `settings.json` under `env`:

```
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

Then install it as a plugin, from GitHub or from a local clone:

```
/plugin marketplace add zyx1121/today-mod
/plugin install today-mod@today-mod
```

It needs the zyx utils scripts on disk (see `scriptsDir`), `uv` at `/opt/homebrew/bin/uv`, macOS Automation access to Calendar and Reminders for your terminal, and an E3 login (`utils e3p login`) for deadlines. A source that is missing or denied is reported on the line and in `/today`; the others still show.

In the session:

```
/today          the whole agenda as Markdown
/today off      hide the line (remembered)
/today on       show it again
```

## What it shows

| Part | Content |
|------|---------|
| `📅` | The event running now (`now`) or the next to start today with a countdown (`in 1h 12m`); `no more events today`; `nothing on the calendar today` |
| `📝` | E3 deadlines within `dueDays`, and how many fall within 3 days |
| `☑` | Reminders overdue, and due later today |
| `⚠️` | How many sources failed; `/today` names them |

The `today` context block carries the same agenda as Markdown: today's events with times and rooms, E3 deadlines with due times and course, open reminders. It is added to the conversation's first message, after the engine's own blocks.

## Configuration

| Field | Type | Default | What it does |
|-------|------|---------|--------------|
| `scriptsDir` | string | the iCloud clone of `zyx1121/plugin`, `utils/scripts` | Where `calendar.py`, `reminders.py` and `e3p.py` live |
| `refreshMs` | number | `300000` | Milliseconds between re-reads. Every open session shares one read per interval. Floored at 60000. |
| `dueDays` | number | `7` | Days ahead to list E3 deadlines |
| `remindersList` | string | `TODO` | The Reminders list to read |
| `showOnStart` | boolean | `true` | Show the line as soon as an interactive session starts. `/today on|off`, once used, wins. |

## How it is built

- `hooks/register.ts` exports `register(on, options)`. On `session.start` it registers `/today`, reads the three sources in parallel and starts two timers: a re-read every `refreshMs`, a redraw every minute for the countdown. `command.run` answers `/today`. `ui.render` on `AbovePrompt` draws the line. `prompt.context` adds the `today` block, waiting up to 8 seconds for a first read still in flight.
- `hooks/shared-read.ts` is the reading every session shares: a JSON file at `$TMPDIR/today-mod/agenda.json`, keyed by the three scripts' argv so another day never matches. A session takes the reading there when it is younger than `refreshMs`; while another session's read is under way it waits for that one (up to 35 seconds) instead of walking Calendar again. `/today` answers from a shared reading under a minute old, else reads the sources itself.
- `hooks/agenda.ts` builds each script's argv, parses the utils JSON envelope (success and failure alike), and turns AppleScript dates (`Monday, September 21, 2026 at 1:20:00 PM`) into local Dates. A recurring calendar event reports its series' first date, so only the time of day is trusted.
- `hooks/views/text.ts` formats the line and the Markdown; `hooks/views/band-view.tsx` draws the line with `Box` and `Text`.
- `types/claude-code.d.ts` is the engine contract, copied from [`anthropics/claude-code/mods/types`](https://github.com/anthropics/claude-code/tree/main/mods/types).

```
bunx -p typescript tsc -p tsconfig.json          # typecheck
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .   # 24 tests, the engine's own harness
```

## Contributing

Issues and PRs are welcome. Ground rules live in [CONTRIBUTING.md](https://github.com/zyx1121/.github/blob/main/CONTRIBUTING.md).

## License

[MIT](LICENSE) · the class is at 13:20, you have time
