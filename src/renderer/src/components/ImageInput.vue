<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <button @click="selectImageFile" class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">
        选择图片文件
      </button>
      <button @click="pasteFromClipboard" class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">
        从剪贴板粘贴
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { openFile, readFileAsDataUrl, readClipboardImage } from '../lib/api'

const emit = defineEmits<{
  'image-selected': [data: { dataUrl: string; buffer: ArrayBuffer }]
}>()

async function selectImageFile() {
  const result = await openFile({
    filters: [{ name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }]
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const data = await readFileAsDataUrl(result.filePaths[0])
    emit('image-selected', { dataUrl: data.dataUrl, buffer: data.buffer })
  }
}

async function pasteFromClipboard() {
  const data = await readClipboardImage()
  if (!data) return
  emit('image-selected', { dataUrl: data.dataUrl, buffer: data.buffer })
}
</script>
