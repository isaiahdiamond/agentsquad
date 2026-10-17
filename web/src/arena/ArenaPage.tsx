import { useEffect, useReducer, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { Building, Scene, Squad } from "@agentsquad/shared"
import Debug from "./Debug"
import { homeOf, useCamera, type Point } from "./camera"
import { MissionPill, ModeCaption, NavPill, Pill, TeamChips, Toaster, modeOf } from "./Hud"
import MapView from "./MapView"
import { Briefing, Complete, NeedsYou, delegated } from "./Panels"
import RoomView from "./RoomView"
import { H, Stage, TALL, W } from "./Sprite"
import { buildingFor, emptyArena, finishedAt, reduce, saveReport, type Received, type Toast } from "./store"
import { positions } from "./world"

export default function ArenaPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [arena, dispatch] = useReducer(reduce, undefined, emptyArena)
  const [connected, setConnected] = useState(false)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [squad, setSquad] = useState<Squad | null>(null)
  const [sceneId, setSceneId] = useState(params.get("scene") ?? "")
  const [view, setView] = useState<string | null>(params.get("view"))
  const [zoom, setZoom] = useState<Building | null>(null)
  const [origin, setOrigin] = useState("50% 50%")
  const [debug, setDebug] = useState(params.has("debug"))
  const [notice, setNotice] = useState("")
  const [stalled, setStalled] = useState(0)
  const cam = useCamera()
  const [follow, setFollow] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [local, setLocal] = useState<Toast[]>([])
  const [openedAt] = useState(Date.now)
  const latest = useRef(arena)
  latest.current = arena

  useEffect(() => {
    fetch("/art/scenes/scenes.json").then((r) => r.json()).then(setScenes).catch(() => setScenes([]))
    fetch("/api/state")
      .then((r) => r.json())
      .then((s: { squad: Squad | null; scene: string | null }) => {
        setSquad(s.squad)
        if (s.scene) setSceneId((cur) => cur || s.scene || "")
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let ws: WebSocket | null = null
    let alive = true
    let retry: ReturnType<typeof setTimeout>
    const connect = () => {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`)
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (alive) retry = setTimeout(connect, 1000)
      }
      ws.onmessage = (msg) => {
        try {
          dispatch({ ...JSON.parse(msg.data), at: Date.now() } as Received)
        } catch {}
      }
    }
    connect()
    return () => {
      alive = false
      clearTimeout(retry)
      ws?.close()
    }
  }, [])

  const replay = params.get("replay")
  useEffect(() => {
    if (!replay || !connected) return
    fetch(`/api/replay/${encodeURIComponent(replay)}`)
      .then((r) => setNotice(r.ok ? "" : "That run wasn't recorded. Mock sessions aren't saved."))
      .catch(() => setNotice("Could not reach the server to start the replay."))
    setParams((p) => {
      p.delete("replay")
      return p
    }, { replace: true })
  }, [replay, connected])

  // If the lead is done but a specialist never reports back, give up waiting after 15s of silence.
  const leadDone = arena.agents.lead?.doneAt ?? 0
  useEffect(() => {
    if (!leadDone || finishedAt(arena) || (!arena.spawns && !arena.toolCount)) return
    const t = setTimeout(() => setStalled(arena.lastAt), 15000)
    return () => clearTimeout(t)
  }, [leadDone, arena.lastAt])

  // The Mission complete card opens 1.5s after the turn ends (REPORT lines fill it in as they arrive) and stays until closed.
  // The report is saved whenever it changes, so /report always shows the latest finished mission.
  const finished = finishedAt(arena) || (stalled && stalled === arena.lastAt ? stalled : 0)
  const [completeAt, setCompleteAt] = useState(0)
  const [closedAt, setClosedAt] = useState(0)
  useEffect(() => {
    if (!finished) return setCompleteAt(0)
    const t = setTimeout(() => setCompleteAt(finished), Math.max(0, finished + 1500 - Date.now()))
    return () => clearTimeout(t)
  }, [finished])
  useEffect(() => {
    if (completeAt) saveReport({ arena: latest.current, squad })
  }, [completeAt, arena.reportAt, squad])
  const showComplete = !!completeAt && completeAt === finished && closedAt !== completeAt
  const viewReport = () => {
    saveReport({ arena: latest.current, squad })
    navigate("/report")
  }
  const replayRun = async () => {
    setClosedAt(completeAt)
    try {
      let file = arena.sessionId ? `${arena.sessionId}.jsonl` : undefined
      if (!file) file = ((await fetch("/api/runs").then((r) => r.json())) as { file: string }[])[0]?.file
      if (!file) return setNotice("No recorded runs yet.")
      setParams((p) => {
        p.set("replay", file)
        return p
      }, { replace: true })
    } catch {
      setNotice("Could not reach the server.")
    }
  }

  // The briefing opens on each prompt and closes 6s after the last delegation (12s if nobody is delegated).
  const [briefAt, setBriefAt] = useState(0)
  const [briefOpen, setBriefOpen] = useState(false)
  const lastSpawn = Math.max(0, ...delegated(arena).map((a) => a.firstAt))
  useEffect(() => {
    if (!arena.promptAt || arena.promptAt < openedAt - 2000) return
    setBriefAt(arena.promptAt)
    setBriefOpen(true)
  }, [arena.promptAt])
  useEffect(() => {
    if (!briefOpen || briefAt !== arena.promptAt) return
    const due = lastSpawn ? lastSpawn + 6000 : arena.promptAt + 12000
    const t = setTimeout(() => setBriefOpen(false), Math.max(0, due - Date.now()))
    return () => clearTimeout(t)
  }, [briefOpen, briefAt, lastSpawn])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") setDebug((d) => !d)
      if (e.key === "Escape") {
        setView(null)
        setZoom(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const scene = scenes.find((s) => s.id === (sceneId || "uf-campus")) ?? scenes.find((s) => s.id === "uf-campus") ?? scenes[0]
  const buildings = scene?.buildings ?? []
  const building = buildings.find((b) => b.id === view || b.interior === view)
  const interior = building && scenes.find((s) => s.id === building.interior)
  const shown = interior ?? scene

  // Each scene opens on its whole view; the camera rests on the middle of its stations and doors.
  useEffect(() => {
    if (shown && cam.view.w) cam.moveTo(homeOf(shown), 1, 0)
  }, [shown?.id, cam.view.w, cam.view.h])

  // Follow: ease toward the newest event (800ms, up to 1.3x), never more than once every 3s; rapid events settle on the latest.
  // When the mission ends the camera eases back to the whole scene.
  const locateRef = useRef<(id: string) => Point | null>(() => null)
  const lastMove = useRef(0)
  const toward = (p: Point) => {
    const home = homeOf(shown!)
    lastMove.current = Date.now()
    cam.moveTo({ x: home.x + (p.x - home.x) * 0.75, y: home.y + (p.y - home.y) * 0.75 }, 1.3)
  }
  // Stand-up moment: on a prompt the camera eases to the lead (600ms) while the squad portals in around it; once the
  // delegations stop for a moment, "Lead assembled the team", and the camera eases back out as they walk off.
  const [standing, setStanding] = useState(false)
  const mission = delegated(arena)
  useEffect(() => {
    if (!arena.promptAt || arena.promptAt < openedAt - 2000 || !shown) return
    setStanding(true)
    const p = locateRef.current("lead")
    if (follow && p) {
      lastMove.current = Date.now()
      cam.moveTo(p, 1.3, 600)
    }
  }, [arena.promptAt])
  useEffect(() => {
    if (!standing) return
    const n = mission.length
    const due = n ? lastSpawn + 300 * n + 1500 : arena.promptAt + 12000
    const t = setTimeout(() => {
      if (n) setLocal((l) => [...l.slice(-4), { id: `assembled-${arena.promptAt}`, agentId: "lead", agentType: "lead", text: "Lead assembled the team", tone: "info", named: false, at: Date.now() }])
      setTimeout(() => {
        setStanding(false)
        if (follow && shown) {
          lastMove.current = Date.now()
          cam.moveTo(homeOf(shown), 1)
        }
      }, n ? 1700 : 0)
    }, Math.max(0, due - Date.now()))
    return () => clearTimeout(t)
  }, [standing, lastSpawn, mission.length])

  useEffect(() => {
    if (!follow || !shown || !arena.focusId || finished || standing) return
    const t = setTimeout(() => {
      const p = locateRef.current(arena.focusId!)
      if (p) toward(p)
    }, Math.max(0, lastMove.current + 3000 - Date.now()))
    return () => clearTimeout(t)
  }, [arena.focusAt, follow, shown?.id, !!finished, standing])
  useEffect(() => {
    if (!follow || !finished || !shown) return
    lastMove.current = Date.now()
    cam.moveTo(homeOf(shown), 1)
  }, [!!finished, follow])

  // Drag pans and the wheel zooms; either one hands the camera to the user, turning Follow off.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const onChrome = (t: EventTarget) => !!(t as HTMLElement).closest?.("[data-chrome], .pointer-events-auto")
  const pointer = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || onChrome(e.target)) return
      drag.current = { x: e.clientX, y: e.clientY, moved: false }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return
      if (!d.moved) {
        d.moved = true
        setFollow(false)
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }
      cam.panBy(e.clientX - d.x, e.clientY - d.y)
      d.x = e.clientX
      d.y = e.clientY
    },
    onPointerUp: () => {
      dragged.current = !!drag.current?.moved
      drag.current = null
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!dragged.current) return
      dragged.current = false
      e.stopPropagation()
      e.preventDefault()
    },
    onWheel: (e: React.WheelEvent) => {
      if (onChrome(e.target)) return
      setFollow(false)
      cam.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015))
    },
  }

  if (!scene) return <div className="p-10 text-sm text-muted">Loading scene...</div>

  const specialists = Object.values(arena.agents).filter((a) => a.type !== "lead").sort((a, b) => a.order - b.order)
  const inside = building ? specialists.filter((a) => buildingFor(scene, a.type) === buildings.indexOf(building)) : []
  const open = (b: Building) => {
    setOrigin(`${(b.area.x + b.area.w / 2) * 100}% ${(b.area.y + b.area.h / 2) * 100}%`)
    setZoom(b)
  }
  const away = !!(interior || zoom)
  const waiter = Object.values(arena.agents).sort((a, b) => a.order - b.order).find((a) => !a.doneAt && a.state === "waiting")

  // Where an agent is on screen right now; on the map, an agent inside a building is found at its door.
  const locate = (id: string): Point | null => {
    const p = positions.get(`${shown!.id}:${id}`)
    const a = arena.agents[id]
    if (p && (p.o?.get() ?? 1) > 0.3) return { x: p.x.get() * W, y: p.y.get() * H + (p.dy?.get() ?? 0) - TALL * p.s * 0.6 }
    if (!interior && scene.kind === "map" && a && a.type !== "lead") {
      const b = buildings[buildingFor(scene, a.type)]
      if (b) return { x: b.door.x * W, y: b.door.y * H - 120 }
    }
    return null
  }
  locateRef.current = locate
  const pick = (id: string) => {
    const p = locate(id)
    if (!p) return
    setFollow(false)
    cam.moveTo(p, 1.3)
  }

  return (
    <div ref={cam.ref} className="fixed inset-0 touch-none select-none overflow-hidden bg-bg" {...pointer}>
      <Stage.Provider value={{ fit: cam.cover, ui: cam.ui }}>
        <motion.div
          className="absolute left-0 top-0 origin-top-left" data-stage
          style={{ width: W, height: H, transform: cam.transform, imageRendering: "pixelated", "--ui": cam.ui } as never}
        >
          {scene.kind === "map" ? (
            <motion.div
              className="absolute inset-0"
              style={{ transformOrigin: origin, pointerEvents: away ? "none" : "auto" }}
              initial={false}
              animate={away ? { scale: 2.6, opacity: 0 } : { scale: 1, opacity: 1 }}
              transition={{ duration: zoom ? 0.65 : 0.45, ease: "easeInOut" }}
              onAnimationComplete={() => {
                if (zoom) {
                  setView(zoom.id)
                  setZoom(null)
                }
              }}
            >
              <MapView scene={scene} arena={arena} squad={squad} onOpen={open} />
            </motion.div>
          ) : (
            <RoomView scene={scene} arena={arena} squad={squad} members={specialists} main />
          )}
          <AnimatePresence>
            {interior && (
              <motion.div
                key={interior.id + building!.id} className="absolute inset-0 z-[300]"
                initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.08 }}
                transition={{ duration: 0.45 }}
              >
                <RoomView scene={interior} arena={arena} squad={squad} members={inside} main={false} />
              </motion.div>
            )}
          </AnimatePresence>
          {debug && <Debug scene={interior ?? scene} />}
        </motion.div>
      </Stage.Provider>

      <div className="pointer-events-none absolute inset-0 z-10 select-text">
        <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2">
          <NavPill />
          <MissionPill arena={arena} finished={finished} connected={connected} />
        </div>
        <div className="pointer-events-auto absolute right-4 top-4">
          <TeamChips arena={arena} squad={squad} onPick={pick} />
        </div>
        <div className="absolute right-4 top-[72px]">
          <AnimatePresence>{briefOpen && arena.prompt && <Briefing key={briefAt} arena={arena} squad={squad} onClose={() => setBriefOpen(false)} />}</AnimatePresence>
        </div>
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <AnimatePresence>
            {showComplete && (
              <Complete key={completeAt} arena={arena} squad={squad} finished={finished} onClose={() => setClosedAt(completeAt)} onReport={viewReport} onReplay={replayRun} />
            )}
          </AnimatePresence>
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          <AnimatePresence>{waiter && <NeedsYou key={waiter.id} agent={waiter} arena={arena} squad={squad} />}</AnimatePresence>
          <Toaster items={[...arena.toasts, ...local]} squad={squad} since={openedAt} />
        </div>
        <div className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-2">
          <Pill on={logOpen} onClick={() => setLogOpen((o) => !o)}>
            <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M3 4h10M3 8h10M3 12h6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" /></svg>
            Log
          </Pill>
          <Pill on={follow} onClick={() => setFollow((f) => !f)} label="Follow the action" title={follow ? "Following the action. Drag or scroll to look around." : "Follow the action"}>
            <svg viewBox="0 0 16 16" className="h-4 w-4"><circle cx={8} cy={8} r={5} fill="none" stroke="currentColor" strokeWidth={1.6} /><circle cx={8} cy={8} r={1.6} fill="currentColor" /></svg>
            Follow
          </Pill>
        </div>
        <div className="pointer-events-auto absolute bottom-4 left-4 flex flex-col items-start gap-2">
        <AnimatePresence>
          {interior && (
            <motion.div key="back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-[rgba(11,13,18,0.6)] px-3.5 py-2 text-[13px] font-medium text-text backdrop-blur-[12px] transition-colors hover:border-accent"
                onClick={() => setView(null)}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
                Back to map
              </button>
            </motion.div>
          )}
        </AnimatePresence>
          <ModeCaption text={modeOf(arena, finished, connected)} />
        </div>
        {notice && (
          <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-4 rounded-[14px] border border-white/[0.08] bg-[rgba(11,13,18,0.6)] px-4 py-3 text-[13px] text-text backdrop-blur-[12px]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            {notice}
            <button className="rounded-md px-1.5 text-muted hover:text-text" onClick={() => setNotice("")} aria-label="Dismiss">✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
