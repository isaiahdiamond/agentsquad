import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"

export const GLASS = "border border-white/[0.08] bg-[rgba(11,13,18,0.6)] backdrop-blur-[12px]"

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const link = ({ isActive }: { isActive: boolean }) => `rounded-full px-2.5 py-1 transition-colors ${isActive ? "bg-white/[0.08] text-text" : "text-muted hover:text-text"}`

// The app nav, collapsed to the wordmark until hovered or focused.
export function NavPill({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`flex h-9 items-center rounded-full pl-4 pr-1.5 text-[13px] ${GLASS}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
    >
      <span className="pr-2.5 font-semibold text-text">agentsquad</span>
      <nav className={`flex items-center gap-0.5 overflow-hidden transition-[max-width,opacity] duration-200 ${open ? "max-w-[260px] opacity-100" : "max-w-0 opacity-0"}`}>
        <NavLink to="/builder" className={link}>Builder</NavLink>
        <NavLink to="/arena" className={link}>Arena</NavLink>
        <NavLink to="/report" className={link}>Report</NavLink>
      </nav>
      {children}
    </div>
  )
}
