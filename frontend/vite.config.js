import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { dedupe: ['react', 'react-dom', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 5173,
    proxy: { '/api': { target: process.env.BACKEND_ORIGIN || 'http://127.0.0.1:8000' } },
    fs: { allow: ['..'] } },
})
