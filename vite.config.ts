import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const projectRoot = __dirname

export default defineConfig({
  root: 'src/renderer',
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/util']
  },
  plugins: [
    tailwindcss(),
    vue(),
    electron([
      {
        entry: resolve(projectRoot, 'src/main/index.ts'),
        onstart(args) {
          args.startup()
        },
        vite: {
          build: {
            outDir: resolve(projectRoot, 'dist/main'),
            rollupOptions: {
              external: ['better-sqlite3', 'sqlite-vec', 'node-fetch', 'form-data']
            }
          }
        }
      },
      {
        entry: resolve(projectRoot, 'src/preload/index.ts'),
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: resolve(projectRoot, 'dist/preload'),
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
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
