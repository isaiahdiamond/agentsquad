// Copied from vault/Contracts.md. Read-only after Phase 0: request changes in vault/Decisions.md.

export type AgentState =
  | "idle" | "thinking" | "reading" | "searching"
  | "writing" | "running" | "waiting" | "done" | "error"

export type AgentEvent = {
  id: string
  ts: number
  sessionId: string
  agentId: string        // "lead" or a subagent instance id
  agentType: string      // roster id like "frontend-dev"; "lead" for the main agent
  kind: "session_start" | "prompt" | "spawn" | "tool_start" | "tool_end"
      | "agent_done" | "session_end" | "narration"
  state?: AgentState
  tool?: string          // Read, Edit, Write, Bash, Grep, Glob, Task/Agent...
  target?: string        // file path, command or pattern, cut to 60 chars
  text?: string          // narration line or prompt text
  parentId?: string      // on spawn
}

export type Look = {
  body: string           // id from looks.json bodies, e.g. "body-a"
  hair: string           // "hair-1" ... or "none"
  hairColor: string      // hex
  outfit: string         // "outfit-hoodie"
  hat: string            // "hat-cap" or "none"
}

export type LookManifest = {
  bodies:  { id: string; label: string }[]
  hair:    { id: string; label: string; file: Record<string, string> }[]  // keyed by body id
  outfits: { id: string; label: string; file: Record<string, string> }[]  // body+outfit full render, keyed by body id
  hats:    { id: string; label: string; file: Record<string, string> }[]
  hairColors: string[]
}

export type Character = {
  id: string             // "frontend-dev"; lead is always "lead"
  name: string           // display name, e.g. "Nova"
  role: string           // "UI Engineer"
  isLead: boolean
  look: Look | null      // lead uses look; specialists use portrait
  portrait: string       // /art/roster/frontend-dev.png
  color: string          // accent hex for glow, lines, bubbles
  stats: { speed: number; rigor: number; creativity: number }  // 1-99, cosmetic plus model choice
  tools: string[]
  model: "haiku" | "sonnet" | "opus" | "inherit"
  description: string    // when Claude should delegate to it
  prompt: string         // agent system prompt body
}

export type Squad = {
  lead: Character
  members: Character[]   // 1 to 4
  scene: string          // scene id
}

export type Spot = { x: number; y: number; scale: number }  // x, y in 0-1 of the image

export type Scene = {
  id: string             // "uf-campus" | "bar" | "office"
  name: string
  background: string     // /art/scenes/uf-campus.png (16:9, 1920x1080)
  lead: Spot
  stations: Spot[]       // where working specialists stand, at least 4
  bench: Spot            // where idle specialists wait, they line up from here
  ambient?: string       // optional looping sound
}

