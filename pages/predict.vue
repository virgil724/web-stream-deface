<template>

  <div>
    <Tabs default-value="stream" v-model:model-value="tabs" class="w-[80vw]">
      <TabsList class="flex flex-row ">
        <TabsTrigger v-for='item in InputList' :value="item.title" class="flex-auto">
          {{ item.title }}
        </TabsTrigger>
      </TabsList>

      <TabsContent v-for='item in InputList' :value="item.title">
        <Card class="w-full aspect-video">
          <CardContent class=" flex flex-col pt-5 gap-2">
            <div v-if="item.title == VideoType.Capture" class="flex gap-3">

              <Select @update:model-value="camChange">
                <SelectTrigger class="w-[180px]">
                  <SelectValue placeholder="Select Camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Camera</SelectLabel>
                    <SelectItem v-for="item in cameraOption" :value="item.label">{{ item.label }}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

            </div>
            <SourceChoose v-if="!LoadContent" :button-disable="buttondisable" :handle-load-click="handleLoadClick"
              :source-type="item.title">
              <DropZone v-model="file" v-if="item.title == VideoType.File" />

              <Input placeholder="Stream URL" v-model="stream_url.url" v-if="item.title == VideoType.Stream" />
            </SourceChoose>

            <Player v-else :video="video" :back="back"></Player>
          </CardContent>
        </Card>
      </TabsContent>

    </Tabs>
  </div>
</template>

<script lang="ts" setup>
const camChange = async (val) => {
  const cam = cameraOption.value?.find(value => value.label === val);
  stream.value = await getStream(cam.deviceId)

}
const getStream = async (deviceId: string) => {
  const constrains = { video: { deviceId } }
  return await navigator.mediaDevices.getUserMedia(constrains)
}

import type { BackendContext } from '~/utils/provide_keys';
const buttondisable = computed(() => {
  switch (tabs.value) {
    case VideoType.Stream:
      return !pass.value
      break;
    case VideoType.File:
      return file.value.length == 0
      break;
    case VideoType.Capture:
      return !stream.value
      break
    default:
      return true
      break;
  }

})

import { useAsyncValidator } from '@vueuse/integrations/useAsyncValidator';
import type { Rules } from 'async-validator'
const stream = ref<MediaStream>()
const cameraOption = ref<MediaDeviceInfo[]>()

const rule: Rules = {
  url: [
    { type: 'url', required: true }
  ]
}
const stream_url = reactive({ url: '' })
const { pass, isFinished, errorFields } = useAsyncValidator(stream_url, rule)

const file = ref<{ name: string, size: number, type: string, lastModified: number, file: File }[]>([])

const InputList = computed(() => {
  return Object.values(VideoType).map((item) => {

    return { title: item }
  })

})
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
          content: file.value[0].file, // 這裡需要實際的 File 對象
        } as FileVideo

      case VideoType.Capture:
        // 這裡需要一個 MediaStream 對象，暫時使用 null
        return {
          type: VideoType.Capture,
          content: stream.value, // 這裡需要實際的 MediaStream 對象
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
const back = () => {
  LoadContent.value = false
}
const { backend } = inject(backend_provide) as BackendContext;

const sess = ref<InferenceSession | null>()

onMounted(async () => {
  // TODO 這個要先拿到視訊鏡頭權限
  sess.value = await createSession(backend.value)


  cameraOption.value = (await navigator.mediaDevices.enumerateDevices()).filter((value) => value.kind === 'videoinput')
})

provide(onnx_provide, sess)

onUnmounted(() => {
  stream.value = undefined
})
</script>

<style></style>