<template>
  <div class="space-y-3">
    <h2 class="text-sm font-medium text-gray-300">
      搜索结果
      <span class="text-gray-500 font-normal ml-1">({{ results.length }} 条)</span>
    </h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="item in results"
        :key="item.id"
        class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-blue-500 transition-colors"
      >
        <div class="relative">
          <img :src="`data:image/jpeg;base64,${item.image_blob}`" class="w-full h-48 object-cover" />
          <div class="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold"
            :class="getSimilarityClass(item.similarity)"
          >
            {{ item.similarity }}%
          </div>
          <div v-if="item.facial_area_x !== undefined" class="absolute inset-0 border-2 border-green-500 pointer-events-none"
            :style="{
              left: item.facial_area_x + 'px',
              top: item.facial_area_y + 'px',
              width: item.facial_area_w + 'px',
              height: item.facial_area_h + 'px'
            }"
          ></div>
        </div>
        <div class="p-3 text-xs text-gray-400 space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-gray-500">相似度:</span>
            <span class="text-green-400 font-bold">{{ item.similarity }}%</span>
          </div>
          <div class="truncate" :title="item.video_path">
            <span class="text-gray-500">视频:</span>
            <button @click="openVideo(item.video_path)" class="text-blue-400 hover:text-blue-300 ml-1 truncate max-w-full">
              {{ item.video_path || '(无视频)' }}
            </button>
          </div>
          <div>
            <span class="text-gray-500">置信度:</span>
            {{ (item.face_confidence * 100).toFixed(1) }}%
          </div>
          <div>
            <span class="text-gray-500">录入时间:</span>
            {{ formatDate(item.created_at) }}
          </div>
          <div v-if="item.note" class="truncate">
            <span class="text-gray-500">备注:</span>
            {{ item.note }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchResult } from '../lib/types'
import { openPath } from '../lib/api'

defineProps<{
  results: SearchResult[]
}>()

function getSimilarityClass(similarity: number): string {
  if (similarity >= 90) return 'bg-green-600 text-white'
  if (similarity >= 70) return 'bg-blue-600 text-white'
  if (similarity >= 50) return 'bg-yellow-600 text-white'
  return 'bg-red-600 text-white'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function openVideo(filePath: string) {
  if (filePath) {
    openPath(filePath)
  }
}
</script>
