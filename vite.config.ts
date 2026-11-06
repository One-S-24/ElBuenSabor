import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Escucha en todas las interfaces para poder abrir la app desde el teléfono.
    host: true,
    port: 5173,
    strictPort: true,
  },
})
