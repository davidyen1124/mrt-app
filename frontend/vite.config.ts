import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('../data', import.meta.url))
    }
  },
  server: {
    fs: { allow: ['..'] },
    // `npm run dev` in worker/ serves the API on 8787; point elsewhere with VITE_API_ORIGIN.
    proxy: { '/api': process.env.VITE_API_ORIGIN ?? 'http://localhost:8787' }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { maplibre: ['maplibre-gl'] }
      }
    }
  }
})
