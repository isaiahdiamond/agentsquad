import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom"
import "./index.css"
import BuilderPage from "./builder/BuilderPage"
import ArenaPage from "./arena/ArenaPage"
import ReportPage from "./report/ReportPage"

const link = ({ isActive }: { isActive: boolean }) =>
  isActive ? "text-gold-400" : "text-slate-400 hover:text-gold-300"

// The builder has its own progress bar, so the dev nav only shows elsewhere.
function Nav() {
  if (useLocation().pathname.startsWith("/builder")) return null
  return (
    <nav className="flex gap-6 border-b-2 border-gold-600 bg-navy-950 px-6 py-2 font-pixel text-[10px]">
      <span className="text-gold-400">AGENTSQUAD</span>
      <NavLink to="/builder" className={link}>Builder</NavLink>
      <NavLink to="/arena" className={link}>Arena</NavLink>
      <NavLink to="/report" className={link}>Report</NavLink>
    </nav>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/builder" replace />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/arena" element={<ArenaPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
