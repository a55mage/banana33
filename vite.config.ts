import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativo: funziona su GitHub Pages qualunque sia il nome del repository
export default defineConfig({
  base: './',
  plugins: [react()],
})
