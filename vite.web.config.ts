import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import renderer from 'vite-plugin-electron-renderer'

const projectRoot = __dirname

export default defineConfig({
  root: 'src/renderer',
  plugins: [
    tailwindcss(),
    vue(),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src/renderer/src')
    }
  },
  build: {
    outDir: '../../dist/renderer'
  }
})
