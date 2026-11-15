import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: { chunkSizeWarningLimit: 6000 }, // Plotly pesa ~4 MB; se acepta para mantener una sola librería de gráficas
})
