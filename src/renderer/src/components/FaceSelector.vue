<template>
  <div class="relative inline-block">
    <img :src="imageUrl" ref="imageEl" class="max-w-full" @load="drawBoxes" />
    <canvas
      ref="canvasEl"
      class="absolute inset-0 w-full h-full"
      @click="onClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { DetectedFace } from '../lib/types'

const props = defineProps<{
  imageUrl: string
  faces: DetectedFace[]
}>()

const emit = defineEmits<{
  'select-face': [index: number]
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const imageEl = ref<HTMLImageElement | null>(null)

watch(() => props.faces, () => {
  nextTick(drawBoxes)
})

function drawBoxes() {
  const canvas = canvasEl.value
  const img = imageEl.value
  if (!canvas || !img) return

  const rect = img.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const scaleX = rect.width / img.naturalWidth
  const scaleY = rect.height / img.naturalHeight

  for (const face of props.faces) {
    const x = face.facial_area.x * scaleX
    const y = face.facial_area.y * scaleY
    const w = face.facial_area.w * scaleX
    const h = face.facial_area.h * scaleY

    ctx.strokeStyle = face.selected ? '#22c55e' : '#ef4444'
    ctx.lineWidth = face.selected ? 3 : 2
    ctx.strokeRect(x, y, w, h)

    ctx.fillStyle = face.selected ? '#22c55e' : '#ef4444'
    ctx.font = '12px sans-serif'
    ctx.fillText(`${(face.face_confidence * 100).toFixed(1)}%`, x + 4, y - 4 > 12 ? y - 4 : y + 14)
  }
}

function onClick(event: MouseEvent) {
  const canvas = canvasEl.value
  const img = imageEl.value
  if (!canvas || !img) return

  const rect = canvas.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top

  for (let i = props.faces.length - 1; i >= 0; i--) {
    const face = props.faces[i]
    const scaleX = rect.width / img.naturalWidth
    const scaleY = rect.height / img.naturalHeight
    const x = face.facial_area.x * scaleX
    const y = face.facial_area.y * scaleY
    const w = face.facial_area.w * scaleX
    const h = face.facial_area.h * scaleY

    if (clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
      emit('select-face', i)
      return
    }
  }
}
</script>
