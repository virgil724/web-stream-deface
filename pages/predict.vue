<template>
  <div>
    <Tabs default-value="stream" v-model:model-value="tabs" class="w-[80vw]">
      <TabsList class="flex flex-row ">
        <TabsTrigger value="stream" class="flex-auto">
          Stream
        </TabsTrigger>
        <!-- <TabsTrigger value="file" class="flex-auto">
          File
        </TabsTrigger>
        <TabsTrigger value="capture" class="flex-auto">
          Capture
        </TabsTrigger> -->
      </TabsList>
      <TabsContent value="stream">
        <Card class="w-full aspect-video">
          <CardContent class=" flex flex-col pt-5 gap-2">
            <div class="flex flex-col gap-2" v-if="!LoadContent">
              <Input placeholder="Stream URL" v-model="stream_url.url" />
              <Button :disabled="!pass" @click="handleLoadClick">Load Stream</Button>
            </div>
            <Player v-else :video="video" :back="back"></Player>
          </CardContent>
        </Card>
      </TabsContent>

    </Tabs>
  </div>
</template>

<script lang="ts" setup>


import type { BackendContext } from '~/utils/provide_keys';
import type { InferenceSession } from 'onnxruntime-web';


import { useAsyncValidator } from '@vueuse/integrations/useAsyncValidator';
import type { Rules } from 'async-validator'
const rule: Rules = {
  url: [
    { type: 'url', required: true }
  ]
}
const stream_url = reactive({ url: '' })

const { pass, isFinished, errorFields } = useAsyncValidator(stream_url, rule)

const tabs = ref<String>('stream')
const video = computed<Video>(
  () => {
    const type = tabs.value.toString() as VideoType
    const content = stream_url.url
    switch (type) {
      case VideoType.Stream:
        return {
          type: VideoType.Stream,
          content: stream_url.url,
          // 如果需要，可以添加 streamType
        } as StreamVideo

      case VideoType.File:
        // 這裡需要一個 File 對象，暫時使用 null
        return {
          type: VideoType.File,
          content: null as unknown as File, // 這裡需要實際的 File 對象
        } as FileVideo

      case VideoType.Capture:
        // 這裡需要一個 MediaStream 對象，暫時使用 null
        return {
          type: VideoType.Capture,
          content: null as unknown as MediaStream, // 這裡需要實際的 MediaStream 對象
        } as CaptureVideo

      default:
        throw new Error(`Invalid video type: ${type}`)
    }

  }

)

const LoadContent = ref(false)
const handleLoadClick = () => {
  LoadContent.value = true
}
const back=()=>{
  LoadContent.value=false
}
const { backend } = inject(backend_provide) as BackendContext;
const sess = ref<InferenceSession | null>()
provide(onnx_provide, sess as Ref<InferenceSession>)

onMounted(async () => {

  sess.value = await createSession(backend.value)

})
</script>

<style></style>