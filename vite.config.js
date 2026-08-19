import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.PORT || 8000

  return {
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        '/translate': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/preview': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/auth': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/publish': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/callback': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      }
    }
  }
})
