import type { Character, Look } from "@agentsquad/shared"

export const STEPS = ["lead", "squad", "scene"] as const
export type Step = "title" | (typeof STEPS)[number]

export type Member = { id: string; model: Character["model"] }

export type Draft = {
  step: Step
  name: string
  look: Look | null
  members: Member[]
  scene: string
}

export const MAX_MEMBERS = 4
const KEY = "agentsquad.draft"

export const emptyDraft: Draft = { step: "title", name: "Lead Agent", look: null, members: [], scene: "uf-campus" }

export function loadDraft(): Draft {
  const params = new URLSearchParams(location.search)
  let draft = emptyDraft
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) draft = { ...emptyDraft, ...JSON.parse(saved) }
  } catch {}
  if (import.meta.env.DEV) {
    // Dev only: ?draft=<json> seeds the draft, ?step=lead|squad|scene jumps to a step (for screenshots).
    const seed = params.get("draft")
    if (seed) draft = { ...emptyDraft, ...JSON.parse(seed) }
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
