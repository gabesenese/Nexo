#!/usr/bin/env node
// Claude Code hook receiver: logs agent/tool activity + token usage to a
// JSONL file that `.claude/tui/dashboard.cjs` tails live. Wired up for
// PreToolUse, PostToolUse, SubagentStop, Stop, and UserPromptSubmit in
// .claude/settings.json. No dependencies — plain Node so it runs anywhere
// `node` is on PATH.
//
// Claude Code invokes hooks as separate short-lived processes, so nothing
// here persists across calls except what's written to disk: the activity
// log itself, and a small per-session state file used to compute token
// deltas from the transcript (its `usage` blocks are cumulative-looking
// per API call, not cumulative across the session, so we track "highest
// usage index seen" rather than diffing totals).

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const LOG_DIR = path.join(REPO_ROOT, ".claude", "logs");
const LOG_FILE = path.join(LOG_DIR, "agent-activity.jsonl");
const STATE_DIR = path.join(LOG_DIR, "state");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function safeJSON(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Best-effort agent attribution. Stock Claude Code hook payloads identify
// the *tool* being called, not "which subagent is currently running" for
// nested tool calls inside a subagent — only the Task dispatch itself names
// the subagent. So: Task calls are attributed to the subagent they invoke;
// everything else is attributed to "main" unless a future Claude Code
// version starts passing an explicit agent field, which we check for first.
function resolveAgent(input) {
  const direct =
    input.agent_type || input.agentType || input.subagent || input.agent;
  if (direct) return direct;

  if (input.tool_name === "Task" || input.tool_name === "Agent") {
    const ti = input.tool_input || {};
    return ti.subagent_type || ti.description || "subagent";
  }
  return "main";
}

// Sum every usage block in the transcript so far, and return only the
// portion not yet attributed to this session (tracked in STATE_DIR).
function tokenDelta(sessionId, transcriptPath) {
  const empty = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return empty;

  let totals = { ...empty };
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  } catch {
    return empty;
  }

  for (const line of lines) {
    if (!line.trim()) continue;
    const obj = safeJSON(line, null);
    const usage = obj && obj.message && obj.message.usage;
    if (!usage) continue;
    totals.input += usage.input_tokens || 0;
    totals.output += usage.output_tokens || 0;
    totals.cacheRead += usage.cache_read_input_tokens || 0;
    totals.cacheCreate += usage.cache_creation_input_tokens || 0;
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const statePath = path.join(STATE_DIR, `${sessionId || "unknown"}.json`);
  const prev = fs.existsSync(statePath)
    ? safeJSON(fs.readFileSync(statePath, "utf8"), empty)
    : empty;

  const delta = {
    input: Math.max(0, totals.input - prev.input),
    output: Math.max(0, totals.output - prev.output),
    cacheRead: Math.max(0, totals.cacheRead - prev.cacheRead),
    cacheCreate: Math.max(0, totals.cacheCreate - prev.cacheCreate),
  };

  fs.writeFileSync(statePath, JSON.stringify(totals));
  return delta;
}

function main() {
  const raw = readStdin();
  const input = safeJSON(raw, {});

  const event = input.hook_event_name || "Unknown";
  const sessionId = input.session_id || "unknown";
  const agent = resolveAgent(input);
  const tokens = tokenDelta(sessionId, input.transcript_path);

  const record = {
    ts: new Date().toISOString(),
    event,
    sessionId,
    agent,
    toolName: input.tool_name || null,
    detail:
      event === "UserPromptSubmit"
        ? (input.prompt || "").slice(0, 200)
        : input.tool_name === "Task" || input.tool_name === "Agent"
          ? (input.tool_input && input.tool_input.description) || null
          : null,
    tokens,
    cwd: input.cwd || null,
  };

  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
}

// A logging hook must never block or fail the real tool call it's attached
// to — swallow anything unexpected and exit 0 either way.
try {
  main();
} catch {
  // ignore
}
process.exit(0);
