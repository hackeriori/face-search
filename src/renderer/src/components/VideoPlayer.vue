<template>
  <div
    ref="containerEl"
    class="h-full bg-gray-900 rounded overflow-hidden relative flex flex-col"
    @dragenter.prevent
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <div v-if="!videoPath" class="flex items-center justify-center flex-1 text-gray-500 text-sm">
      尚未选择视频文件
    </div>

    <template v-else>
      <div
        ref="videoArea"
        class="h-full bg-black flex items-center justify-center text-gray-600 select-none flex-1 relative"
      >
        <video
          ref="videoEl"
          class="absolute inset-0 w-full h-full object-contain bg-black"
          muted
          playsinline
        ></video>
        <img
          v-if="previewDataUrl && status.state !== 'playing'"
          :src="previewDataUrl"
          class="absolute inset-0 w-full h-full object-contain bg-black"
          alt=""
        />
        <div v-if="status.state === 'idle' || status.state === 'stopped'" class="flex flex-col items-center gap-2 text-gray-500">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs">等待 ffmpeg 推流...</span>
        </div>
        <div v-else-if="!activeStreamUrl" class="w-full h-full flex items-center justify-center">
          <div class="text-center">
            <div class="animate-pulse text-blue-400 text-xs">{{ status.filename }}</div>
          </div>
        </div>
      </div>

      <div class="bg-linear-to-t shrink-0 from-black/90 to-transparent p-2">
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
          <button
            @click="seekRelative(-10)"
            :disabled="status.state === 'idle' || status.state === 'stopped'"
            class="hover:text-white transition-colors disabled:opacity-40"
            title="后退10秒"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 18V6l-7 6 7 6zm-8 0V6l-7 6 7 6z"/>
            </svg>
          </button>
          <button
            @click="frameBackStep"
            :disabled="status.state === 'idle' || status.state === 'stopped'"
            class="hover:text-white transition-colors disabled:opacity-40"
            title="后退一帧"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 18V6h2v12H4zm3.5-6l8.5 6V6l-8.5 6z"/>
            </svg>
          </button>
          <button
            @click="frameStep"
            :disabled="status.state === 'idle' || status.state === 'stopped'"
            class="hover:text-white transition-colors disabled:opacity-40"
            title="前进一帧"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 6v12h-2V6h2zm-3.5 6L6 6v12l8.5-6z"/>
            </svg>
          </button>
          <button
            @click="seekRelative(10)"
            :disabled="status.state === 'idle' || status.state === 'stopped'"
            class="hover:text-white transition-colors disabled:opacity-40"
            title="快进10秒"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 6v12l7-6-7-6zm8 0v12l7-6-7-6z"/>
            </svg>
          </button>
          <span>{{ formatTime(status.timePos) }} / {{ formatTime(status.duration) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import flvjs from 'flv.js'
import type { MpvStatusInfo, MpvBounds } from '../lib/types'

const props = defineProps<{ videoPath: string }>()
const emit = defineEmits<{
  'frame-captured': [data: { dataUrl: string; buffer: ArrayBuffer }]
  'file-dropped': [path: string]
}>()

const containerEl = ref<HTMLDivElement | null>(null)
const videoArea = ref<HTMLDivElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const activeStreamUrl = ref('')
const previewDataUrl = ref('')
const status = reactive<MpvStatusInfo>({
  state: 'idle',
  duration: 0,
  timePos: 0,
  filename: '',
})
let resizeObserver: ResizeObserver | null = null
let flvPlayer: flvjs.Player | null = null

onMounted(() => {
  window.electronAPI.playerOnStatus((s) => {
    status.state = s.state
    status.duration = s.duration
    status.timePos = s.timePos
    status.filename = s.filename
    status.streamUrl = s.streamUrl
    if (s.state === 'playing' && s.streamUrl) {
      previewDataUrl.value = ''
      loadStream(s.streamUrl)
    }
  })
  window.electronAPI.playerOnStopped(() => {
    status.state = 'stopped'
  })

  if (containerEl.value) {
    resizeObserver = new ResizeObserver(() => {
      if (props.videoPath && status.state !== 'idle') {
        window.electronAPI.playerResize(getVideoBounds())
      }
    })
    resizeObserver.observe(containerEl.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  destroyStream()
  window.electronAPI.playerClose()
})

function onDrop(event: DragEvent) {
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    try {
      const path = window.electronAPI.getPathForFile(file)
      if (path) {
        emit('file-dropped', path)
      }
    } catch {
      // ignore
    }
  }
}

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
  status.streamUrl = undefined
  activeStreamUrl.value = ''
  previewDataUrl.value = ''
  destroyStream()

  if (!path) return

  await nextTick()
  const bounds = getVideoBounds()

  try {
    const result = await window.electronAPI.playerOpen(path, bounds)
    Object.assign(status, result.status)
    loadStream(result.streamUrl)
  } catch (e: any) {
    console.error('ffmpeg stream open failed:', e)
    status.state = 'stopped'
  }
})

function onSeekInput(event: Event) {
  const target = event.target as HTMLInputElement
  status.timePos = parseFloat(target.value)
}

async function onSeekChange(event: Event) {
  const target = event.target as HTMLInputElement
  const time = parseFloat(target.value)
  status.timePos = time
  await window.electronAPI.playerSeek(time)
  if (status.state !== 'playing') {
    await updatePreviewFrame()
  }
}

async function togglePlay() {
  const wasPlaying = status.state === 'playing'
  await window.electronAPI.playerTogglePause()
  if (wasPlaying) {
    await updatePreviewFrame()
  }
}

async function seekRelative(offset: number) {
  await window.electronAPI.playerSeekRelative(offset)
  if (status.state !== 'playing') {
    await updatePreviewFrame()
  }
}

async function frameStep() {
  await window.electronAPI.playerFrameStep()
  await updatePreviewFrame()
}

async function frameBackStep() {
  await window.electronAPI.playerFrameBackStep()
  await updatePreviewFrame()
}

async function captureCurrentFrame() {
  try {
    const result = await window.electronAPI.playerCaptureFrame()
    previewDataUrl.value = result.dataUrl
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

function loadStream(url: string) {
  if (!videoEl.value || activeStreamUrl.value === url) return

  destroyStream()
  activeStreamUrl.value = url

  if (flvjs.isSupported()) {
    flvPlayer = flvjs.createPlayer({
      type: 'flv',
      url,
      isLive: true,
      hasAudio: false,
    })
    flvPlayer.attachMediaElement(videoEl.value)
    flvPlayer.load()
    videoEl.value.play().catch(() => {})
    return
  }

  videoEl.value.src = url
  videoEl.value.play().catch(() => {})
}

function destroyStream() {
  if (flvPlayer) {
    flvPlayer.unload()
    flvPlayer.detachMediaElement()
    flvPlayer.destroy()
    flvPlayer = null
  }
  if (videoEl.value) {
    videoEl.value.removeAttribute('src')
    videoEl.value.load()
  }
}

async function updatePreviewFrame() {
  if (!props.videoPath) return
  try {
    const result = await window.electronAPI.playerCaptureFrame()
    previewDataUrl.value = result.dataUrl
  } catch (e: any) {
    console.error('Frame preview failed:', e)
  }
}

defineExpose({ captureFrame: captureCurrentFrame })
</script>
