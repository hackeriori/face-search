<template>
  <div class="flex flex-col flex-1 min-h-0">
    <h2 class="text-sm font-medium text-gray-300 shrink-0 mb-4">
      搜索结果
      <span class="text-gray-500 font-normal ml-1">({{ actorGroups.length }} 位演员)</span>
    </h2>

    <div v-if="!actorGroups.length" class="flex-1 flex items-center justify-center">
      <div class="text-gray-500">无匹配结果</div>
    </div>

    <div v-else class="space-y-3 flex-1 overflow-y-auto min-h-0">
      <div v-for="group in actorGroups" :key="group.actor_id" class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex">
        <div class="shrink-0">
          <img
            :src="`data:image/jpeg;base64,${group.best_match.image_blob}`"
            class="h-60 cursor-pointer border-r border-gray-700 object-contain"
            @click="previewImage(`data:image/jpeg;base64,${group.best_match.image_blob}`, group.best_match)"
          />
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <div class="flex items-center gap-3 p-3 border-b border-gray-700">
            <span class="text-sm font-medium text-gray-200">演员 #{{ group.actor_id }}</span>
            <span class="text-xs text-gray-500 ml-2">{{ group.items.length }} 部视频</span>
            <div class="ml-auto flex items-center gap-2">
              <span class="text-xs text-gray-400">相似度：</span>
              <div
                class="px-1.5 py-0.5 rounded text-xs font-bold"
                :class="getSimilarityClass(group.best_match.similarity)"
              >
                {{ group.best_match.similarity }}%
              </div>
            </div>

          </div>
          <div class="flex-1 overflow-y-auto">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700/30 border-b border-gray-700/50 last:border-none"
            >
              <div class="flex-1 min-w-0 flex items-center gap-2">
                <span class="text-xs text-gray-400 shrink-0">视频：</span>
                <button @click="openVideo(item.video_path)" class="text-xs text-blue-400 hover:text-blue-300 truncate min-w-0 text-left">
                  {{ item.video_path || '-' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="previewData" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click.self="previewData = null">
      <div class="relative inline-flex overflow-hidden rounded-lg">
        <img ref="previewDisplayImage" :src="previewData.src" class="max-w-[90vw] max-h-[90vh] object-contain" @load="drawPreviewFaces" />
        <canvas ref="previewFaceCanvas" class="absolute inset-0 w-full h-full pointer-events-none" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { SearchResult, SearchResultGroup } from '../lib/types'
import { openPath } from '../lib/api'

const props = defineProps<{
  results: SearchResult[]
}>()

const previewData = ref<{ src: string; facialArea: { x: number; y: number; w: number; h: number } } | null>(null)
const previewFaceCanvas = ref<HTMLCanvasElement | null>(null)
const previewDisplayImage = ref<HTMLImageElement | null>(null)

const actorGroups = computed<SearchResultGroup[]>(() => {
  const map = new Map<number, SearchResult[]>()
  for (const item of props.results) {
    if (!map.has(item.actor_id)) {
      map.set(item.actor_id, [])
    }
    map.get(item.actor_id)!.push(item)
  }
  const groups: SearchResultGroup[] = []
  for (const [actorId, items] of map) {
    items.sort((a, b) => b.similarity - a.similarity)
    groups.push({
      actor_id: actorId,
      items,
      best_match: items[0]
    })
  }
  groups.sort((a, b) => b.best_match.similarity - a.best_match.similarity)
  return groups
})

function getSimilarityClass(similarity: number): string {
  if (similarity >= 90) return 'bg-green-600 text-white'
  if (similarity >= 70) return 'bg-blue-600 text-white'
  if (similarity >= 50) return 'bg-yellow-600 text-white'
  return 'bg-red-600 text-white'
}

function openVideo(filePath: string) {
  if (filePath) {
    openPath(filePath)
  }
}

function previewImage(src: string, result?: SearchResult) {
  previewData.value = result && result.facial_area_x != null && result.facial_area_y != null && result.facial_area_w != null && result.facial_area_h != null
    ? { src, facialArea: { x: result.facial_area_x, y: result.facial_area_y, w: result.facial_area_w, h: result.facial_area_h } }
    : { src, facialArea: { x: 0, y: 0, w: 0, h: 0 } }
  nextTick(() => drawPreviewFaces())
}

function drawPreviewFaces() {
  const canvas = previewFaceCanvas.value
  const img = previewDisplayImage.value
  if (!canvas || !img || !previewData.value) return

  const fa = previewData.value.facialArea
  if (!fa.w || !fa.h) return

  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
  const renderedW = img.naturalWidth * scale
  const renderedH = img.naturalHeight * scale
  const offsetX = (rect.width - renderedW) / 2
  const offsetY = (rect.height - renderedH) / 2
  const faceScaleX = renderedW / img.naturalWidth
  const faceScaleY = renderedH / img.naturalHeight

  const x = offsetX + fa.x * faceScaleX
  const y = offsetY + fa.y * faceScaleY
  const w = fa.w * faceScaleX
  const h = fa.h * faceScaleY

  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 3
  ctx.strokeRect(x, y, w, h)
}
</script>
