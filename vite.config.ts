import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// No GitHub Pages o site fica em https://oliveiraisabelle.github.io/zzrockwell/
export default defineConfig({
  base: '/zzrockwell/',
  plugins: [react()],
})
