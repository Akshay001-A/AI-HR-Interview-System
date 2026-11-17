import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom', 'lucide-react', 'axios'] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { allow: ['../../..'] },
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
})
