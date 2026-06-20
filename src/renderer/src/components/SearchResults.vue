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
      <div v-for="group in actorGroups" :key="group.actor_id" class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div
          @click="toggleActor(group.actor_id)"
          class="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-700/50 transition-colors select-none"
        >
          <img
            :src="`data:image/jpeg;base64,${group.best_match.image_blob}`"
            class="w-10 h-10 object-cover rounded shrink-0 cursor-pointer border border-gray-600"
            @click.stop="previewImage(`data:image/jpeg;base64,${group.best_match.image_blob}`)"
          />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-gray-200">演员 #{{ group.actor_id }}</span>
            <span class="text-xs text-gray-500 ml-2">{{ group.items.length }} 部视频</span>
          </div>
          <div class="flex items-center shrink-0">
            <span class="text-xs text-gray-400">相似度：</span>
            <div
              class="px-1.5 py-0.5 rounded text-xs font-bold"
              :class="getSimilarityClass(group.best_match.similarity)"
            >
              {{ group.best_match.similarity }}%
            </div>
          </div>
          <span class="text-xs text-gray-500 transition-transform" :class="expandedActors.has(group.actor_id) ? 'rotate-180' : ''">▼</span>
        </div>
        <div v-if="expandedActors.has(group.actor_id)" class="border-t border-gray-700">
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

    <div v-if="previewImg" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click.self="previewImg = ''">
      <img :src="previewImg" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SearchResult, SearchResultGroup } from '../lib/types'
import { openPath } from '../lib/api'

const props = defineProps<{
  results: SearchResult[]
}>()

const previewImg = ref('')
const expandedActors = ref(new Set<number>())

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

watch(actorGroups, (groups) => {
  expandedActors.value = new Set(groups.map(g => g.actor_id))
}, { immediate: true })

function toggleActor(actorId: number) {
  const s = new Set(expandedActors.value)
  if (s.has(actorId)) {
    s.delete(actorId)
  } else {
    s.add(actorId)
  }
  expandedActors.value = s
}

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
