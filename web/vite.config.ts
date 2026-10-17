import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// PORT and WEB_PORT let parallel worktrees run side by side. Defaults are the real ones.
const serverPort = process.env.PORT ?? "4317"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/api": { target: `http://localhost:${serverPort}`, rewrite: (path) => path.replace(/^\/api/, "") },
      "/ws": { target: `ws://localhost:${serverPort}`, ws: true },
    },
  },
})
