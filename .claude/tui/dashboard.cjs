#!/usr/bin/env node
// Live terminal dashboard for the Nexo subagent team. Tails
// .claude/logs/agent-activity.jsonl (written by .claude/hooks/log-event.cjs,
// wired up in .claude/settings.json) and renders: which agent is active,
// what tool it's using, running token totals per agent, and a scrolling
// event feed. No dependencies — plain Node + ANSI escapes.
//
// Run from anywhere: `node .claude/tui/dashboard.cjs` (or `npm run
// agents:watch` from the repo root). Ctrl+C to quit.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const LOG_FILE = path.join(REPO_ROOT, ".claude", "logs", "agent-activity.jsonl");

const MAX_FEED = 14;
const POLL_MS = 400;
const STALE_MS = 30_000; // no events in 30s -> agent shown as idle, not "active"

const state = {
  startedAt: Date.now(),
  offset: 0,
  feed: [], // {ts, agent, event, toolName, detail}
  agents: new Map(), // name -> {events, lastTool, lastSeen, tokens:{input,output,cacheRead,cacheCreate}}
  sessions: new Set(),
};

function agentRow(name) {
  if (!state.agents.has(name)) {
    state.agents.set(name, {
      events: 0,
      lastTool: null,
      lastEvent: null,
      lastSeen: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
    });
  }
  return state.agents.get(name);
}

function applyRecord(r) {
  state.sessions.add(r.sessionId);
  const row = agentRow(r.agent || "main");
  row.events += 1;
  row.lastEvent = r.event;
  row.lastSeen = Date.parse(r.ts) || Date.now();
  if (r.toolName) row.lastTool = r.toolName;
  if (r.tokens) {
    row.tokens.input += r.tokens.input || 0;
    row.tokens.output += r.tokens.output || 0;
    row.tokens.cacheRead += r.tokens.cacheRead || 0;
    row.tokens.cacheCreate += r.tokens.cacheCreate || 0;
  }

  state.feed.push(r);
  if (state.feed.length > MAX_FEED) state.feed.shift();
}

function poll() {
  let size = 0;
  try {
    size = fs.statSync(LOG_FILE).size;
  } catch {
    render();
    return;
  }

  if (size < state.offset) state.offset = 0; // log was rotated/truncated
  if (size === state.offset) {
    render();
    return;
  }

  const fd = fs.openSync(LOG_FILE, "r");
  const buf = Buffer.alloc(size - state.offset);
  fs.readSync(fd, buf, 0, buf.length, state.offset);
  fs.closeSync(fd);
  state.offset = size;

  for (const line of buf.toString("utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      applyRecord(JSON.parse(line));
    } catch {
      // ignore malformed line
    }
  }

  render();
}

function pad(str, len) {
  str = String(str ?? "");
  if (str.length > len) return str.slice(0, len - 1) + "…";
  return str + " ".repeat(len - str.length);
}

function fmtNum(n) {
  return n.toLocaleString("en-US");
}

function fmtAgo(ts) {
  if (!ts) return "--";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function render() {
  const lines = [];
  const uptime = Math.round((Date.now() - state.startedAt) / 1000);

  lines.push("\x1b[1mNEXO — AGENT ACTIVITY\x1b[0m");
  lines.push(
    `watching ${path.relative(REPO_ROOT, LOG_FILE)}  |  sessions: ${state.sessions.size}  |  uptime: ${uptime}s`
  );
  lines.push("");

  // Agent table
  lines.push(
    "\x1b[2m" +
      pad("AGENT", 20) +
      pad("STATUS", 9) +
      pad("EVENTS", 8) +
      pad("LAST TOOL", 16) +
      pad("LAST SEEN", 10) +
      pad("TOKENS in/out (cache)", 30) +
      "\x1b[0m"
  );

  const grand = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, events: 0 };
  const names = [...state.agents.keys()].sort((a, b) => {
    if (a === "main") return -1;
    if (b === "main") return 1;
    return a.localeCompare(b);
  });

  for (const name of names) {
    const row = state.agents.get(name);
    const active = Date.now() - row.lastSeen < STALE_MS;
    const status = active ? "\x1b[32m● active\x1b[0m" : "\x1b[90m○ idle\x1b[0m";
    const tokenStr = `${fmtNum(row.tokens.input)}/${fmtNum(row.tokens.output)} (${fmtNum(row.tokens.cacheRead + row.tokens.cacheCreate)})`;

    lines.push(
      pad(name, 20) +
        pad(status, 18) + // status has ansi codes, pad loosely
        pad(row.events, 8) +
        pad(row.lastTool || "--", 16) +
        pad(fmtAgo(row.lastSeen), 10) +
        pad(tokenStr, 30)
    );

    grand.input += row.tokens.input;
    grand.output += row.tokens.output;
    grand.cacheRead += row.tokens.cacheRead;
    grand.cacheCreate += row.tokens.cacheCreate;
    grand.events += row.events;
  }

  if (names.length === 0) {
    lines.push("\x1b[2m(no activity logged yet — waiting on hook events)\x1b[0m");
  }

  lines.push("");
  lines.push(
    `\x1b[1mtotals\x1b[0m  events: ${fmtNum(grand.events)}  tokens in: ${fmtNum(grand.input)}  out: ${fmtNum(grand.output)}  cache: ${fmtNum(grand.cacheRead + grand.cacheCreate)}`
  );
  lines.push("");

  // Recent feed
  lines.push("\x1b[1mrecent events\x1b[0m");
  if (state.feed.length === 0) {
    lines.push("\x1b[2m(none yet)\x1b[0m");
  } else {
    for (const r of state.feed.slice().reverse()) {
      const t = new Date(r.ts).toLocaleTimeString();
      const label = r.detail ? `${r.event} — ${r.detail}` : r.event;
      lines.push(
        `\x1b[2m${t}\x1b[0m  ${pad(r.agent || "main", 18)} ${pad(r.toolName || "", 14)} ${label}`
      );
    }
  }

  lines.push("");
  lines.push("\x1b[2mCtrl+C to quit\x1b[0m");

  // Full-screen redraw
  process.stdout.write("\x1b[2J\x1b[H" + lines.join("\n") + "\n");
}

fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
render();
setInterval(poll, POLL_MS);
