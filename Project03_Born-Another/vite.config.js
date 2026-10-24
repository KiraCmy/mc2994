import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bind IPv4 explicitly — default [::1] alone breaks browsers that resolve
  // localhost → 127.0.0.1 on Windows.
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
