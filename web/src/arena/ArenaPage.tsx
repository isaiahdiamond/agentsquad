import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { Building, Scene, Squad } from "@agentsquad/shared"
import Debug from "./Debug"
import { Rail, TopBar } from "./Hud"
import MapView from "./MapView"
import RoomView from "./RoomView"
import { Stage } from "./Sprite"
import { buildingFor, emptyArena, finishedAt, reduce, saveReport, type Received } from "./store"

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
  const [top, setTop] = useState(0)
  const [notice, setNotice] = useState("")
  const [stalled, setStalled] = useState(0)
  const [stage, setStage] = useState({ w: 1600, h: 900 })
  const observer = useRef<ResizeObserver>(null)
  const latest = useRef(arena)
  latest.current = arena

  useLayoutEffect(() => setTop(document.querySelector("nav")?.getBoundingClientRect().bottom ?? 0), [])

  const stageRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    observer.current = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }))
    observer.current.observe(el)
  }, [])

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
    if (!leadDone || finishedAt(arena)) return
    const t = setTimeout(() => setStalled(arena.lastAt), 15000)
    return () => clearTimeout(t)
  }, [leadDone, arena.lastAt])

  // Wait 2s for REPORT lines, 1.5s more after each one, never more than 6s.
  const finished = finishedAt(arena) || (stalled && stalled === arena.lastAt ? stalled : 0)
  useEffect(() => {
    if (!finished) return
    const due = Math.min(finished + 6000, Math.max(finished + 2000, arena.reportAt + 1500))
    const t = setTimeout(() => {
      saveReport({ arena: latest.current, squad })
      navigate("/report")
    }, due - Date.now())
    return () => clearTimeout(t)
  }, [finished, arena.reportAt])

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
  if (!scene) return <div className="p-10 text-sm text-muted">Loading scene...</div>

  const buildings = scene.buildings ?? []
  const building = buildings.find((b) => b.id === view || b.interior === view)
  const interior = building && scenes.find((s) => s.id === building.interior)
  const specialists = Object.values(arena.agents).filter((a) => a.type !== "lead").sort((a, b) => a.order - b.order)
  const inside = building ? specialists.filter((a) => buildingFor(scene, a.type) === buildings.indexOf(building)) : []
  const open = (b: Building) => {
    setOrigin(`${(b.area.x + b.area.w / 2) * 100}% ${(b.area.y + b.area.h / 2) * 100}%`)
    setZoom(b)
  }
  const away = !!(interior || zoom)

  return (
    <div className="fixed inset-x-0 bottom-0 flex bg-bg" style={{ top }}>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar arena={arena} squad={squad} connected={connected} title={building && interior ? `${scene.name} · ${building.name}` : scene.name} />
        <div className="relative flex min-h-0 flex-1 items-center justify-center" style={{ containerType: "size" }}>
          <div
            ref={stageRef} className="relative overflow-hidden bg-bg"
            style={{ width: "min(100cqw, calc(100cqh * 16 / 9))", aspectRatio: "16 / 9", containerType: "inline-size" }}
          >
            <Stage.Provider value={stage}>
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
                  <button
                    className="absolute bottom-4 left-4 z-[700] flex items-center gap-2 rounded-xl border border-line-strong bg-panel/90 px-3.5 py-2 text-sm font-semibold text-text shadow-[0_8px_24px_rgba(0,0,0,.45)] backdrop-blur-md transition-colors hover:border-accent"
                    onClick={() => setView(null)}
                  >
                    <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Back to map
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            {debug && <Debug scene={interior ?? scene} />}
            {notice && (
              <div className="card absolute left-1/2 top-4 z-[900] flex -translate-x-1/2 items-center gap-4 px-4 py-3 text-sm text-text shadow-[0_8px_24px_rgba(0,0,0,.45)]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                {notice}
                <button className="rounded-md px-1.5 text-muted hover:text-text" onClick={() => setNotice("")} aria-label="Dismiss">✕</button>
              </div>
            )}
            <AnimatePresence>
              {finished > 0 && (
                <motion.div
                  className="absolute inset-0 z-[800] flex items-center justify-center bg-bg/50 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <motion.div className="card flex items-center gap-3 px-7 py-5 shadow-[0_16px_48px_rgba(0,0,0,.5)]" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                      <svg viewBox="0 0 10 10" className="w-4"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    </span>
                    <span className="text-xl font-semibold text-text">Task complete</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            </Stage.Provider>
          </div>
        </div>
      </div>
      <Rail arena={arena} squad={squad} />
    </div>
  )
}
