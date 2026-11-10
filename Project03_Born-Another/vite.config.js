import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { interpretApi } from './server/vitePlugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only settings (AI provider, model, API keys) from .env.local etc.
  // The '' prefix loads every variable for the server; the browser bundle
  // still only ever sees VITE_* variables — never name a key VITE_*.
  const serverEnv = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), interpretApi(serverEnv)],
    // Bind IPv4 explicitly — default [::1] alone breaks browsers that resolve
    // localhost → 127.0.0.1 on Windows.
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
  }
})
