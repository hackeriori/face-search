<template>
  <div ref="containerEl" class="h-full bg-gray-900 rounded overflow-hidden relative flex flex-col" style="min-height: 200px;">
    <div v-if="!videoPath" class="flex items-center justify-center flex-1 text-gray-500 text-sm">
      尚未选择视频文件
    </div>

    <template v-else>
      <div
        ref="videoArea"
        class="h-full bg-black flex items-center justify-center text-gray-600 select-none flex-1"
        :style="{ minHeight: '200px' }"
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

      <div class="bg-linear-to-t from-black/90 to-transparent p-2">
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
        <div class="flex items-center gap-2 text-xs text-white/70 mt-1">
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
      </div>
    </template>
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
  const el = videoArea.value ?? containerEl.value
  if (!el) return { x: 100, y: 100, w: 640, h: 360 }

  const rect = el.getBoundingClientRect()

  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    w: Math.round(rect.width),
    h: Math.round(rect.height),
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
