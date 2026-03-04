import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ffmpeg.wasm requires SharedArrayBuffer, which needs COOP/COEP headers.
// When running locally (not in an iframe preview), start with:
//   COOP=1 npx vite
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: process.env.COOP
      ? {
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Opener-Policy': 'same-origin',
        }
      : {},
  },
})
