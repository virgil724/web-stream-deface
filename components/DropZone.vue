<template>
  <Card ref="dropZoneRef" class="w-full h-[300px] bg-slate-500">
    <CardContent>
      <div class="content-center h-full m-auto text-center">
        <div>
          isOverDropZone: {{ isOverDropZone }}
        </div>
        <div v-for="(file, index) in filesData" :key="index" class="w-200px bg-black-200/10 ma-2 pa-6">
          <p class="truncate">Name: {{ file.name }}</p>
          <p>Size: {{ file.size }}</p>
          <p>Type: {{ file.type }}</p>
          <p>Last modified: {{ file.lastModified }}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts" setup>
import { useDropZone } from '@vueuse/core';
const filesData = defineModel({ required: true })
const dropZoneRef = ref<HTMLDivElement>()
// const filesData = ref<{ name: string, size: number, type: string, lastModified: number,file:File }[]>([])
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

const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop, dataTypes: ["video/mp4"] })


</script>

<style></style>