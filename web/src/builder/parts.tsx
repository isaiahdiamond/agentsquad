import { motion } from "framer-motion"
import { STEPS, type Step } from "./draft"

export function Progress({ step, className = "" }: { step: Step; className?: string }) {
  const current = STEPS.indexOf(step as (typeof STEPS)[number])
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="text-[13px] font-medium text-muted">
        Step {current + 1} of {STEPS.length}
      </p>
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="h-1 w-20 overflow-hidden rounded-full bg-line-strong">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: i <= current ? "100%" : "0%" }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Back"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-panel text-text transition-colors hover:border-accent"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 10H4M9 5l-5 5 5 5" />
      </svg>
    </button>
  )
}
