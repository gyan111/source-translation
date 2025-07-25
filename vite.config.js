import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/translate': 'http://localhost:3000',
      '/preview': 'http://localhost:3000'
    }
  }
})
