<template>
  <div class="flex flex-col h-screen">
    <header class="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-4 shrink-0">
      <h1 class="text-lg font-bold text-blue-400">Face Search</h1>
      <nav class="flex gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="currentTab = tab.id"
          :class="[
            'px-4 py-1.5 rounded text-sm font-medium transition-colors',
            currentTab === tab.id
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          ]"
        >
          {{ tab.label }}
        </button>
      </nav>
      <div v-if="apiStatus" class="ml-auto text-xs flex items-center gap-2">
        <span :class="apiStatus.ok ? 'text-green-400' : 'text-red-400'" class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full" :class="apiStatus.ok ? 'bg-green-400' : 'bg-red-400'"></span>
          API: {{ apiStatus.ok ? 'OK' : 'ERR' }}
        </span>
        <span v-if="apiStatus.detail" class="text-gray-500">{{ apiStatus.detail }}</span>
      </div>
    </header>
    <main class="flex-1 overflow-hidden">
      <RecordPage v-if="currentTab === 'record'" />
      <SearchPage v-else-if="currentTab === 'search'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import RecordPage from './pages/RecordPage.vue'
import SearchPage from './pages/SearchPage.vue'
import { checkApi } from './lib/api'

const currentTab = ref('record')
const tabs = [
  { id: 'record', label: '人脸录入' },
  { id: 'search', label: '人脸搜索' }
]

const apiStatus = ref<{ ok: boolean; detail: string } | null>(null)

onMounted(async () => {
  try {
    const result = await checkApi()
    apiStatus.value = { ok: true, detail: result.recognition_model }
  } catch (e: any) {
    apiStatus.value = { ok: false, detail: e.message }
  }
})
</script>
