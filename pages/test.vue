<template>
  <div>
    <Player :video></Player>
  </div>
</template>

<script lang="ts" setup>
const video = ref({
  type: VideoType.Stream,
  content: '',})
</script>

<style></style>