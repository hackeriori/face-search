<template>
  <div ref="containerEl" class="bg-gray-900 rounded overflow-hidden relative" style="min-height: 200px;">
    <div v-if="!videoPath" class="flex items-center justify-center h-48 text-gray-500 text-sm">
      尚未选择视频文件
    </div>

    <div v-else class="relative">
      <div
        ref="videoArea"
        class="w-full bg-black flex items-center justify-center text-gray-600 select-none"
        :style="{ minHeight: '200px', maxHeight: '16rem' }"
      >
        <div v-if="status.state === 'idle' || status.state === 'stopped'" class="flex flex-col items-center gap-2 text-gray-500">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs">mpv 播放器中...</span>
        </div>
        <div v-else class="w-full h-full flex items-center justify-center">
          <div class="text-center">
            <div class="animate-pulse text-blue-400 text-xs">{{ status.filename }}</div>
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
        <input
          type="range"
          :min="0"
          :max="status.duration || 0"
          :step="0.1"
          :value="status.timePos"
          @input="onSeekInput"
          @change="onSeekChange"
          class="w-full h-1 accent-blue-500 cursor-pointer"
        />
        <div class="flex justify-between items-center text-xs text-white/70 mt-1">
          <div class="flex items-center gap-2">
            <button
              @click="togglePlay"
              :disabled="status.state === 'idle' || status.state === 'stopped'"
              class="hover:text-white transition-colors disabled:opacity-40"
            >
              <svg v-if="status.state === 'paused'" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            </button>
            <span>{{ formatTime(status.timePos) }} / {{ formatTime(status.duration) }}</span>
          </div>
          <button
            @click="captureCurrentFrame"
            :disabled="status.state === 'idle' || status.state === 'stopped'"
            class="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-xs disabled:opacity-40 transition-colors"
          >
            截帧
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, nextTick, onBeforeUnmount } from 'vue'
import type { MpvStatusInfo, MpvBounds } from '../lib/types'

const props = defineProps<{ videoPath: string }>()
const emit = defineEmits<{
  'frame-captured': [data: { dataUrl: string; buffer: ArrayBuffer }]
}>()

const containerEl = ref<HTMLDivElement | null>(null)
const videoArea = ref<HTMLDivElement | null>(null)
const status = reactive<MpvStatusInfo>({
  state: 'idle',
  duration: 0,
  timePos: 0,
  filename: '',
})
let isSeeking = false

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.electronAPI.mpvOnStatus((s) => {
    status.state = s.state
    status.duration = s.duration
    status.timePos = s.timePos
    status.filename = s.filename
  })
  window.electronAPI.mpvOnStopped(() => {
    status.state = 'stopped'
  })

  if (containerEl.value) {
    resizeObserver = new ResizeObserver(() => {
      if (props.videoPath && status.state !== 'idle') {
        window.electronAPI.mpvResize(getVideoBounds())
      }
    })
    resizeObserver.observe(containerEl.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.electronAPI.mpvClose()
})

function getVideoBounds(): MpvBounds {
  const container = containerEl.value
  if (!container) return { x: 100, y: 100, w: 640, h: 360 }

  const mainWin = window as any
  const screenLeft = mainWin.screenLeft ?? mainWin.screenX ?? 0
  const screenTop = mainWin.screenTop ?? mainWin.screenY ?? 0

  const rect = container.getBoundingClientRect()
  return {
    x: Math.round(rect.left + screenLeft),
    y: Math.round(rect.top + screenTop),
    w: Math.round(rect.width),
    h: Math.round(Math.min(rect.height, 256)),
  }
}

watch(() => props.videoPath, async (path) => {
  status.state = 'idle'
  status.duration = 0
  status.timePos = 0
  status.filename = ''

  if (!path) return

  await nextTick()
  const bounds = getVideoBounds()

  try {
    await window.electronAPI.mpvOpen(path, bounds)
  } catch (e: any) {
    console.error('mpv open failed:', e)
    status.state = 'stopped'
  }
})

function onSeekInput(event: Event) {
  isSeeking = true
  const target = event.target as HTMLInputElement
  status.timePos = parseFloat(target.value)
}

function onSeekChange(event: Event) {
  isSeeking = false
  const target = event.target as HTMLInputElement
  const time = parseFloat(target.value)
  status.timePos = time
  window.electronAPI.mpvSeek(time)
}

async function togglePlay() {
  await window.electronAPI.mpvTogglePause()
}

async function captureCurrentFrame() {
  try {
    const result = await window.electronAPI.mpvCaptureFrame()
    emit('frame-captured', result)
  } catch (e: any) {
    console.error('Frame capture failed:', e)
  }
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

defineExpose({ captureFrame: captureCurrentFrame })
</script>
