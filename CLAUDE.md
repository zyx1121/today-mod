# today-mod

A Claude Code mod (function-hooks plugin): `hooks/register.ts` exports `register(on, options)`; `/today` and the `AbovePrompt` line come from `hooks/agenda.ts` (three zyx utils scripts run as children, JSON envelopes parsed) and `hooks/views/`.

- Typecheck: `bunx -p typescript tsc -p tsconfig.json` (no node_modules; `types/claude-code.d.ts` is the engine contract from `anthropics/claude-code/mods/types`).
- Tests: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .` (tests in `tests/`, scripts mocked by base name).
- Run from source: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .`; a running session does not hot-reload, restart it.
- Engine rules the loader checks: `$` may only be passed to a top-level function; `$.env.get` takes a literal name; a hooks module that breaks one fails to load entirely.
- GitHub-facing text is English. No em dashes.
