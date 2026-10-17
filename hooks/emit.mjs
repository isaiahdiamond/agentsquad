#!/usr/bin/env node
// Claude Code hook: forwards the hook JSON on stdin to the AgentSquad server. Never blocks, never fails.
const port = process.env.AGENTSQUAD_PORT ?? 4317
setTimeout(() => process.exit(0), 1000).unref()

try {
  let body = ""
  for await (const chunk of process.stdin) body += chunk
  await fetch(`http://localhost:${port}/hook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(300),
  })
} catch {}

process.exit(0)
