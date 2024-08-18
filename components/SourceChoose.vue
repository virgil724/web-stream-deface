<template>
  <div class="flex flex-col gap-2">
    <slot />
    <Button :disabled="props.buttonDisable" @click="props.handleLoadClick">Load {{ props.sourceType }}</Button>
  </div>
</template>

<script lang="ts" setup>


const props = defineProps({
  buttonDisable: Boolean,
  handleLoadClick: Function,
  sourceType: String
})
</script>

<style></style>