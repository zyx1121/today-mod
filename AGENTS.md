# today-mod

Claude Code mod (a function-hooks plugin). `hooks/register.ts` exports `register(on, options)`. `/today` and the `AbovePrompt` line come from `hooks/agenda.ts` and `hooks/views/`. The macos and nycu plugin scripts run as child processes, and the mod parses their JSON. Read [README.md](README.md) first.

## Rules

- The loader rejects a hooks module that breaks an engine rule, and the whole mod then fails to load. Pass `$` only to a top-level function. Give `$.env.get` a literal name.
- `types/claude-code.d.ts` is the engine contract from `anthropics/claude-code/mods/types`. Copy it, do not edit it.
- A source that fails must show on the line and in `/today`. The other sources must still show.
- Follow every page of a script result. Do not truncate.
- Repository documents and code comments are English. No em dashes.

## Verify

```sh
bunx -p typescript tsc -p tsconfig.json
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .
```

No node_modules. The tests in `tests/` mock the scripts by base name. To run from source, use `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .`. A running session does not reload hooks, so restart it.

## Release

Release Please opens the release PR from Conventional Commits and bumps `.claude-plugin/plugin.json`.
