<template>
  <div class="bg-black rounded overflow-hidden relative" style="min-height: 200px;">
    <video
      v-if="videoPath && isPlayable"
      ref="videoEl"
      :src="videoUrl"
      class="w-full max-h-64 object-contain"
      controls
      @loadedmetadata="onLoaded"
    ></video>
    <div v-else-if="videoPath && !isPlayable" class="flex items-center justify-center h-48 text-gray-500 text-sm">
      不支持的视频格式 ({{ ext }})<br/>
      <span class="text-xs mt-1">推荐使用 MP4 格式</span>
    </div>
    <div v-else class="flex items-center justify-center h-48 text-gray-600 text-sm">
      尚未选择视频文件
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{ videoPath: string }>()
const emit = defineEmits<{
  'frame-captured': [data: { dataUrl: string; buffer: ArrayBuffer }]
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const videoUrl = ref('')
const isPlayable = ref(false)
const ext = computed(() => {
  const parts = props.videoPath.split('.')
  return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : ''
})

const playableExts = ['.mp4', '.webm', '.ogg', '.mov']

watch(() => props.videoPath, (path) => {
  if (!path) {
    videoUrl.value = ''
    isPlayable.value = false
    return
  }
  isPlayable.value = playableExts.includes(ext.value)
  if (isPlayable.value) {
    const normalized = path.replace(/\\/g, '/')
    videoUrl.value = normalized.startsWith('/') ? 'file://' + normalized : 'file:///' + normalized
  }
})

function onLoaded() {
}

function captureFrame() {
  const video = videoEl.value
  if (!video) return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(video, 0, 0)
  canvas.toBlob(async (blob) => {
    if (!blob) return
    const buffer = await blob.arrayBuffer()
    const dataUrl = URL.createObjectURL(blob)
    emit('frame-captured', { dataUrl, buffer })
  }, 'image/jpeg', 0.92)
}

defineExpose({ captureFrame })
</script>
