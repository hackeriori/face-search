<template>
  <div class="flex flex-col flex-1 min-h-0">
    <h2 class="text-sm font-medium text-gray-300 shrink-0 mb-4">
      搜索结果
      <span class="text-gray-500 font-normal ml-1">({{ actorGroups.length }} 位演员)</span>
    </h2>
    <div class="space-y-4 flex-1 overflow-y-auto min-h-0">
      <div v-for="group in actorGroups" :key="group.actor_id" class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-blue-500 transition-colors">
        <div class="flex gap-4 p-3">
          <div class="relative shrink-0 w-24 h-24 rounded overflow-hidden bg-gray-900 cursor-pointer border border-gray-600" @click="previewImage(`data:image/jpeg;base64,${group.best_match.image_blob}`)">
            <img :src="`data:image/jpeg;base64,${group.best_match.image_blob}`" class="w-full h-full object-cover" />
          <div class="absolute border-2 border-green-500 pointer-events-none"
            :style="{
              left: group.best_match.facial_area_x + 'px',
              top: group.best_match.facial_area_y + 'px',
              width: group.best_match.facial_area_w + 'px',
              height: group.best_match.facial_area_h + 'px'
            }"
          ></div>
          <div class="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold"
            :class="getSimilarityClass(group.best_match.similarity)"
          >
            {{ group.best_match.similarity }}%
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-medium text-gray-200">演员 #{{ group.actor_id }}</span>
            <span class="text-xs text-gray-500">{{ group.items.length }} 条记录</span>
            <span class="text-xs text-gray-500">| {{ group.best_match.actor_created_at || '' }}</span>
          </div>
          <div class="text-xs text-gray-500 mb-2">最高相似度: {{ group.best_match.similarity }}%</div>
          <div class="space-y-1">
            <div v-for="item in group.items" :key="item.id" class="flex items-center gap-2 text-xs">
              <span class="text-gray-500 shrink-0">视频:</span>
              <button @click="openVideo(item.video_path)" class="text-blue-400 hover:text-blue-300 truncate min-w-0">
                {{ item.video_path || '(无视频)' }}
              </button>
              <span class="text-gray-500 shrink-0 ml-auto">{{ item.video_created_at || '' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>

  <div v-if="previewImg" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click.self="previewImg = ''">
    <img :src="previewImg" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SearchResult, SearchResultGroup } from '../lib/types'
import { openPath } from '../lib/api'

const props = defineProps<{
  results: SearchResult[]
}>()

const previewImg = ref('')

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
    items.sort((a, b) => a.similarity - b.similarity)
    groups.push({
      actor_id: actorId,
      items,
      best_match: items[0]
    })
  }
  groups.sort((a, b) => a.best_match.similarity - b.best_match.similarity)
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

function previewImage(src: string) {
  previewImg.value = src
}
</script>
