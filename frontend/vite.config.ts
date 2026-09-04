import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5185,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
})
