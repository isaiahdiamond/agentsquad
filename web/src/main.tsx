import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom"
import "./index.css"
import BuilderPage from "./builder/BuilderPage"
import ArenaPage from "./arena/ArenaPage"
import ReportPage from "./report/ReportPage"

const link = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-bold text-white" : "text-neutral-400 hover:text-white"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <nav className="flex gap-6 border-b border-neutral-800 px-6 py-3 text-sm">
        <span className="font-black tracking-wide">AGENTSQUAD</span>
        <NavLink to="/builder" className={link}>Builder</NavLink>
        <NavLink to="/arena" className={link}>Arena</NavLink>
        <NavLink to="/report" className={link}>Report</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/builder" replace />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/arena" element={<ArenaPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
