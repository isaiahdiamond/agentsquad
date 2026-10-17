# Contracts

Phase 0 copies these into `/shared/types.ts`. After that, nobody changes them without a human approving a request in [[Decisions]].

## AgentEvent (server → browser over WebSocket)

```ts
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
```

Tool to state:

| Tool | State |
|---|---|
| Read | reading |
| Glob, Grep, WebFetch, WebSearch | searching |
| Edit, Write, NotebookEdit | writing |
| Bash | running |
| Task / Agent | lead gets `spawn` event |
| no tool for 2s | thinking |

## Look (the lead's customizable appearance)

```ts
export type Look = {
  body: string           // id from looks.json bodies, e.g. "body-a"
  hair: string           // "hair-1" ... or "none"
  hairColor: string      // hex
  outfit: string         // "outfit-hoodie"
  hat: string            // "hat-cap" or "none"
}
```

The Art stream delivers `web/public/art/looks.json`:

```ts
export type LookManifest = {
  bodies:  { id: string; label: string }[]
  hair:    { id: string; label: string; file: Record<string, string> }[]  // keyed by body id
  outfits: { id: string; label: string; file: Record<string, string> }[]  // body+outfit full render, keyed by body id
  hats:    { id: string; label: string; file: Record<string, string> }[]
  hairColors: string[]
}
```

Layer order bottom to top: outfit render, hair (tinted), hat. A hat hides the hair layer.

## Character (roster entry and lead)

```ts
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
```

## Scene

```ts
export type Spot = { x: number; y: number; scale: number; kind?: "desk" }  // x, y in 0-1 of the image; kind "desk" = desk station

export type Building = {
  id: string             // "library", "lab", "studio", "engineering", "court"
  name: string
  area: { x: number; y: number; w: number; h: number }  // clickable box, 0-1 of image
  door: Spot             // agents walk here, then fade out
  badge: Spot            // where the "who's inside" portraits show
  interior: string       // scene id to open on click
  roles: string[]        // roster ids that work here
}

export type Scene = {
  id: string             // "uf-campus" | "bar" | "beach" | "interior-library" | "interior-lab"
  name: string
  kind: "map" | "room"
  background: string
  scale?: number         // sprite scale in native image pixels (2688x1520 stage); desks and seated sprites use it too
  lead: Spot
  stations: Spot[]       // rooms: where agents stand to work
  bench: Spot
  buildings?: Building[] // maps only
  paths?: Spot[][]       // maps only, walk routes between lead and doors
}
```

Building assignments on UF Campus:

| Building | Roles |
|---|---|
| Studio (art and design) | frontend-dev |
| Engineering | backend-dev |
| Lab | test-engineer |
| Library | scout, docs-writer |
| Court (admin hall) | reviewer |

Scenes live in `web/public/art/scenes/scenes.json` as `Scene[]`. Adding a scene is an art job: drop in an image and add an entry.

No new AgentEvent kinds. The hand-raise effect is driven by `state: "waiting"` and the fire effect by `state: "error"`.

Bridge: emit `waiting` when Claude Code fires a `Notification` hook (permission prompt or idle input) and `error` when a `PostToolUse` result reports failure (non-zero Bash exit, failed edit, failing tests).

## Server endpoints

| Method | Path | Does |
|---|---|---|
| POST | `/hook` | raw Claude Code hook JSON in |
| GET | `/ws` | WebSocket, sends `AgentEvent` |
| POST | `/deploy` | body `Squad`; writes agent files, CLAUDE.md section, hooks; returns `{ files: { path, content }[] }` |
| POST | `/undeploy` | removes all of the above |
| GET | `/runs` | list of recorded runs |
| GET | `/replay/:file?speed=1` | plays a run over `/ws` |
| GET | `/state` | current squad and scene, so a refresh restores the arena |

Port 4317. Web dev server proxies `/api` and `/ws` to it.
