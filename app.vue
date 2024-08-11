<template>
    <div>
        <NuxtPage />
    </div>
</template>
<script lang="ts" setup>
const backend = ref('webgpu')
const updateBackend = (val: string) => {
    backend.value = val

}
provide(backend_provide, { backend, updateBackend })
</script>