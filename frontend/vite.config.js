import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发期 /api 代理到 Flask 后端(默认 5000 端口),
// 部署时由 Nginx 反向代理统一处理。
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
