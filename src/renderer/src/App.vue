<template>
  <div class="flex flex-col h-screen">
    <header class="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-4 shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="w-7 h-7 shrink-0">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4F46E5"/>
            <stop offset="100%" stop-color="#7C3AED"/>
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="112" fill="url(#bg)"/>
        <circle cx="256" cy="230" r="145" fill="none" stroke="#ffffff" stroke-width="22"/>
        <ellipse cx="256" cy="220" rx="70" ry="88" fill="#ffffff"/>
        <path d="M186 190 Q190 100 256 95 Q322 100 326 190 Q310 150 256 145 Q202 150 186 190Z" fill="#4F46E5"/>
        <ellipse cx="233" cy="210" rx="9" ry="7" fill="#4F46E5"/>
        <ellipse cx="279" cy="210" rx="9" ry="7" fill="#4F46E5"/>
        <path d="M256 215 L250 248 Q256 255 262 248 Z" fill="#C7D2FE" fill-opacity="0.6"/>
        <path d="M238 268 Q256 284 274 268" fill="none" stroke="#4F46E5" stroke-width="5" stroke-linecap="round"/>
        <line x1="360" y1="335" x2="445" y2="420" stroke="#ffffff" stroke-width="24" stroke-linecap="round"/>
      </svg>
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
      <FaceManagement v-else-if="currentTab === 'management'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import RecordPage from './pages/RecordPage.vue'
import SearchPage from './pages/SearchPage.vue'
import FaceManagement from './pages/FaceManagement.vue'
import { checkApi } from './lib/api'

const currentTab = ref('record')
const tabs = [
  { id: 'record', label: '人脸录入' },
  { id: 'search', label: '人脸搜索' },
  { id: 'management', label: '人脸管理' }
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
