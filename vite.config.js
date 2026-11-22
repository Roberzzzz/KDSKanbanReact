import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/KDSKanbanReact/',
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // 
        changeOrigin: true,
        secure: false,
      },
    },
  },
})