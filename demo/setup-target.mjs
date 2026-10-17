// Copies demo/target outside the repo so Claude Code doesn't also load this repo's CLAUDE.md during the demo.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const src = fileURLToPath(new URL("./target/", import.meta.url))
const dest = path.resolve(process.argv[2] ?? process.env.AGENTSQUAD_DEMO_TARGET ?? path.join(os.homedir(), "agentsquad-demo-target"))
const skip = new Set(["node_modules", "dist", ".claude", "CLAUDE.md"])

if (fs.existsSync(dest) && fs.readdirSync(dest).length) {
  console.error(`${dest} already exists and is not empty. Delete it or pass another folder.`)
  process.exit(1)
}

fs.cpSync(src, dest, { recursive: true, filter: (p) => !skip.has(path.basename(p)) })
execFileSync("git", ["init", "-q"], { cwd: dest })

console.log(`Demo target ready at ${dest}`)
console.log(`Start AgentSquad with:  TARGET=${dest} npm run dev`)
console.log(`Then: cd ${dest} && npm install && claude`)
