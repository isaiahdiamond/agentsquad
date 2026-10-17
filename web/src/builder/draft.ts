import type { Character, Look } from "@agentsquad/shared"
import { roster } from "./roster"
import { DEFAULT_LEAD_LOOK } from "../ui/sprites"

export const STEPS = ["lead", "squad", "scene"] as const
export type Step = "title" | (typeof STEPS)[number]

export type Member = { id: string; model: Character["model"] }

export type Draft = {
  step: Step
  name: string
  look: Look
  members: Member[]
  scene: string
}

export const MAX_MEMBERS = 4
const KEY = "agentsquad.draft"

export const emptyDraft: Draft = { step: "title", name: "Lead Agent", look: DEFAULT_LEAD_LOOK, members: [], scene: "uf-campus" }

const MODELS = ["haiku", "sonnet", "opus", "inherit"]
export const BODIES = ["a", "b"]
export const OUTFITS = ["blazer", "hoodie", "flannel", "track"]

// Older drafts saved layered looks like { body: "body-a", outfit: "outfit-hoodie" }. Keep what still maps to a variant.
function parseLook(look: unknown): Look {
  if (!look || typeof look !== "object") return DEFAULT_LEAD_LOOK
  const l = look as Record<string, unknown>
  const body = typeof l.body === "string" ? l.body.replace(/^body-/, "") : ""
  const outfit = typeof l.outfit === "string" ? l.outfit.replace(/^outfit-/, "") : ""
  return {
    ...DEFAULT_LEAD_LOOK,
    body: BODIES.includes(body) ? body : DEFAULT_LEAD_LOOK.body,
    outfit: OUTFITS.includes(outfit) ? outfit : DEFAULT_LEAD_LOOK.outfit,
  }
}

// Saved drafts come from old versions or hand edits; anything malformed falls back to the empty draft.
function parseDraft(raw: string): Draft {
  try {
    const d = JSON.parse(raw)
    if (!d || typeof d !== "object" || Array.isArray(d)) return emptyDraft
    if (d.members !== undefined && !Array.isArray(d.members)) return emptyDraft
    const members: Member[] = []
    for (const m of d.members ?? []) {
      const c = m && roster.find((r) => r.id === m.id)
      if (!c || members.some((x) => x.id === c.id)) continue
      if (members.length === MAX_MEMBERS) break
      members.push({ id: c.id, model: MODELS.includes(m.model) ? m.model : c.model })
    }
    return {
      step: d.step === "title" || STEPS.includes(d.step) ? d.step : "title",
      name: typeof d.name === "string" ? d.name : emptyDraft.name,
      look: parseLook(d.look),
      members,
      scene: typeof d.scene === "string" ? d.scene : emptyDraft.scene,
    }
  } catch {
    return emptyDraft
  }
}

export function loadDraft(): Draft {
  const params = new URLSearchParams(location.search)
  let draft = emptyDraft
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) draft = parseDraft(saved)
  } catch {}
  if (import.meta.env.DEV) {
    // Dev only: ?draft=<json> seeds the draft, ?step=lead|squad|scene jumps to a step (for screenshots).
    const seed = params.get("draft")
    if (seed) draft = parseDraft(seed)
    const step = params.get("step")
    if (step === "title" || STEPS.includes(step as never)) draft = { ...draft, step: step as Step }
  }
  return draft
}

export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {}
}

export function saveSquad(squad: unknown) {
  try {
    localStorage.setItem("agentsquad.squad", JSON.stringify(squad))
  } catch {}
}
