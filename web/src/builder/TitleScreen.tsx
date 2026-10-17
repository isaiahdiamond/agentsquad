import { motion } from "framer-motion"
import type { Draft } from "./draft"
import WelcomeLights from "./WelcomeLights"

const BG = "/art/scenes/welcome-bg.png"

export default function TitleScreen({ draft, start, reset }: { draft: Draft; start: () => void; reset: () => void }) {
  const resumed = draft.members.length > 0
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${BG})` }} />
      <WelcomeLights src={BG} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 45% 40%, rgba(11,13,18,0.85), rgba(11,13,18,0.35) 70%, transparent), linear-gradient(to bottom, rgba(11,13,18,0.55), transparent 30%, transparent 70%, rgba(11,13,18,0.7))",
        }}
      />

      <header className="relative flex items-center justify-between px-9 py-6">
        <span className="text-[15px] font-semibold tracking-tight text-white">agentsquad</span>
        <a
          href="https://docs.claude.com/en/docs/claude-code/sub-agents"
          target="_blank"
          rel="noreferrer"
          className="text-[14px] font-medium text-muted transition-colors hover:text-white"
        >
          Docs
        </a>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative flex flex-1 flex-col items-center px-6 pt-[18vh] text-center"
      >
        <h1 className="text-[clamp(40px,4.4vw,64px)] leading-[1.05] font-bold tracking-[-0.03em] text-white">
          Watch your AI team work.
        </h1>
        <p className="mt-5 max-w-xl text-[17px] text-muted">Build a squad of Claude Code agents and see every move they make.</p>
        <button onClick={start} className="btn-white mt-9 rounded-full! px-6! py-3! text-[15px]!">
          Build your squad
        </button>
        {resumed && (
          <button onClick={reset} className="mt-4 text-[13px] text-faint transition-colors hover:text-muted">
            Start a new squad instead
          </button>
        )}
      </motion.div>
    </div>
  )
}
