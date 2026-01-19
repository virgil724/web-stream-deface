<template>
  <div ref="dropZoneRef" 
       class="relative w-full min-h-[180px] rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer"
       :class="isOverDropZone 
         ? 'border-primary bg-primary/10 scale-[1.02]' 
         : 'border-border bg-card/30 hover:border-primary/50 hover:bg-card/50'">
    
    <!-- Empty State -->
    <div v-if="filesData.length === 0" class="flex flex-col items-center justify-center h-full py-8 px-4">
      <div class="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3"
           :class="isOverDropZone ? 'bg-primary/20' : ''">
        <svg class="w-6 h-6" :class="isOverDropZone ? 'text-primary' : 'text-muted-foreground'" 
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-foreground mb-1">
        {{ isOverDropZone ? '放開以上傳檔案' : '拖放影片檔案至此處' }}
      </p>
      <p class="text-xs text-muted-foreground">支援 MP4 格式</p>
    </div>

    <!-- File Preview -->
    <div v-else class="flex flex-col items-center justify-center h-full py-6 px-4">
      <div class="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
        <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <polygon points="10,11 10,17 15,14" fill="currentColor"/>
        </svg>
      </div>
      <div v-for="(file, index) in filesData" :key="index" class="text-center">
        <p class="text-sm font-medium text-foreground truncate max-w-[250px]">{{ file.name }}</p>
        <p class="text-xs text-muted-foreground mt-1">{{ formatFileSize(file.size) }}</p>
      </div>
      <button @click.stop="clearFiles" class="mt-3 text-xs text-muted-foreground hover:text-destructive transition-colors">
        移除檔案
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDropZone } from '@vueuse/core';

const filesData = defineModel({ required: true })
const dropZoneRef = ref<HTMLDivElement>()

function onDrop(files: File[] | null) {
  filesData.value = []
  if (files) {
    filesData.value = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      file: file
    }))
  }
}

function clearFiles() {
  filesData.value = []
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop, dataTypes: ["video/mp4"] })
</script>

<style></style>