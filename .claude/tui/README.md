# Agent activity dashboard

Live terminal view of the Nexo subagent team (`architect`, `backend-implementer`,
`test-verifier`, `code-reviewer`, `docs-writer`): which agent is active, what tool it's
using, running token totals per agent, and a scrolling event feed.

## Run it

```
npm run agents:watch
```

or directly: `node .claude/tui/dashboard.cjs`. Ctrl+C to quit. It's a separate terminal
tab you leave open alongside your normal `claude` session — it doesn't need to be started
before Claude Code, and picks up history already in the log on launch.

## How it works

1. `.claude/settings.json` wires Claude Code's `PreToolUse`, `PostToolUse`, `SubagentStop`,
   `Stop`, and `UserPromptSubmit` hooks to `.claude/hooks/log-event.cjs`.
2. That script reads each hook's JSON payload from stdin, pulls token usage out of the
   session transcript Claude Code already writes (`transcript_path` in the hook payload),
   and appends one line to `.claude/logs/agent-activity.jsonl` (gitignored, local only).
3. `dashboard.cjs` tails that file and redraws the terminal a few times a second. No
   npm dependencies — plain Node + ANSI escapes, so there's nothing to install.

## Known limitation: nested tool-call attribution

Claude Code's hook payload identifies the *tool* being called and, for a `Task` dispatch,
which subagent it's starting — but it does not currently pass "which subagent is
currently running" on the tool calls *that subagent itself makes*. So a `Task` call that
starts `backend-implementer` is correctly attributed to `backend-implementer`, but if that
subagent then calls `Edit`, that `Edit` event is logged under `main` rather than
`backend-implementer`. If a future Claude Code version adds an explicit agent field to the
hook payload, `resolveAgent()` in `log-event.cjs` already checks for the common names
(`agent_type`, `agentType`, `subagent`, `agent`) before falling back — no dashboard change
needed.

## "How agents are improving"

Not built yet — there's no standardized place this repo's agents record whether a given
approach worked. The `memory: project` field on `backend-implementer` and `code-reviewer`
gives them a place to write lessons learned, but reading that back into a trend the
dashboard could chart would need those agents to log something structured (e.g. "reviewed
N files, found M issues, categories: [...]") rather than free-text notes. Worth doing once
there's enough real usage to trend — premature before that, same reasoning as Resolution
Memory in `PHILOSOPHY.md` §18.
