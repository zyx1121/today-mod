<div align="center">

<h1>today-mod</h1>

<p><strong>Your calendar, E3 deadlines and Reminders in one line above the Claude Code prompt.</strong></p>

[![CI](https://img.shields.io/github/actions/workflow/status/zyx1121/today-mod/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zyx1121/today-mod/actions)
[![Release](https://img.shields.io/github/v/release/zyx1121/today-mod?style=flat-square&sort=semver)](https://github.com/zyx1121/today-mod/releases)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757?style=flat-square)](https://github.com/anthropics/claude-code/tree/main/mods)
[![License](https://img.shields.io/github/license/zyx1121/today-mod?style=flat-square)](LICENSE)

**English** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

</div>

```
📅 13:20 3D遊戲程式 · ED102 · in 3h 20m  📝 1 due (1 within 3d)  ☑ 1 overdue
```

Sessions often start with "what do I have today?" and end with a missed class. today-mod reads your day once, keeps the next item in view, and gives the full agenda to Claude. Then "do I have time for this before class?" gets a real answer.

## Features

- **One line above the prompt**: the current or next event with a countdown, the E3 deadlines ahead and the reminders due.
- **Agenda in context**: the first message of each conversation gets a `today` block with the full agenda in Markdown.
- **One read for all sessions**: open sessions share one read every 5 minutes. The countdown updates every minute.
- **Partial failure stays visible**: a source that fails shows `⚠️` on the line, and the other sources still show.

## Quick start

Function hooks are in early access. Turn them on in your shell profile, or in `settings.json` under `env`:

```sh
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

Then install the mod in Claude Code:

```
/plugin marketplace add zyx1121/today-mod
/plugin install today-mod@today-mod
```

Start a new session. The line appears above the prompt.

## Usage

```
/today          the full agenda in Markdown
/today off      hide the line (remembered)
/today on       show it again
```

| Part | Shows |
|------|-------|
| `📅` | The event now (`now`) or the next one today (`in 1h 12m`), or `no more events today` |
| `📝` | E3 deadlines within `dueDays`, and how many fall within 3 days |
| `☑` | Reminders that are overdue or due later today |
| `⚠️` | How many sources failed. `/today` names them |

## Configuration

| Needs | For |
|-------|-----|
| [macos@zyx1121](https://github.com/zyx1121/macos) 0.2.0 or later | Calendar and Reminders through EventKit |
| [nycu@zyx1121](https://github.com/zyx1121/nycu) with an E3 login | E3 deadlines |
| `uv` at `/opt/homebrew/bin/uv` | runs the macos and nycu scripts |
| Full Access to Calendars and Reminders for your terminal | EventKit reads, without opening the apps |

| Setting | Default | Does |
|---------|---------|------|
| `macosScriptsDir` | the `macos@zyx1121` user install | directory of `productivity.py` |
| `nycuScriptsDir` | the `nycu@zyx1121` user install | directory of `e3p.py` |
| `refreshMs` | `300000` | time between reads, 60000 at least |
| `dueDays` | `7` | days ahead for E3 deadlines |
| `remindersList` | `TODO` | reminder list name or native ID |
| `showOnStart` | `true` | show the line when a session starts. `/today on` or `off` wins after first use |

## How it works

- `hooks/register.ts` registers `/today` on `session.start`, reads the 3 sources in parallel and starts the timers. `ui.render` draws the line on `AbovePrompt`, and `prompt.context` adds the `today` block.
- `hooks/shared-read.ts` keeps the shared read in `$TMPDIR/today-mod/agenda.json`. While one session reads, the others wait for its result, so the mod reads Calendar only once.
- `hooks/agenda.ts` calls the scripts with JSON on stdin, follows every page and parses the API v2 results.

## Limits

- macOS only, and Claude Code with function hooks turned on.
- E3 deadlines need an NYCU account.

## For AI agents

Facts for coding agents and LLM tools. The rules for changing the code are in [AGENTS.md](AGENTS.md).

- **Summary**: Claude Code function-hooks mod with a one-line agenda above the prompt and a `today` context block. Sources: macOS Calendar, Reminders and NYCU E3.
- **Type**: plugin
- **Interfaces**: slash command `/today [on|off]`, `AbovePrompt` UI line, `today` prompt context block
- **Install**: `/plugin marketplace add zyx1121/today-mod`, then `/plugin install today-mod@today-mod`
- **Run**: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .`
- **Verify**: `bunx -p typescript tsc -p tsconfig.json && CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .`
- **Config**: plugin options `macosScriptsDir`, `nycuScriptsDir`, `scriptsDir` (legacy), `refreshMs`, `dueDays`, `remindersList`, `showOnStart`
- **Secrets**: none here. The nycu plugin keeps the E3 login.
- **Limits**: macOS. Needs `macos@zyx1121` 0.2.0 or later, `nycu@zyx1121` and `uv`.

## Development

```sh
bunx -p typescript tsc -p tsconfig.json                    # typecheck
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .   # the engine's test harness
```

`types/claude-code.d.ts` is the engine contract from [anthropics/claude-code/mods/types](https://github.com/anthropics/claude-code/tree/main/mods/types). Release Please opens the release PR.

## License

[MIT](LICENSE)
