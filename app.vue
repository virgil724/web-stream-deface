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
useHead(
    {
        script: [{
            innerHTML:
                `(function(c,l,a,r,i,t,y){
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t=l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y=l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", "nn8iok59g8");`
        }]
    }
)
</script>