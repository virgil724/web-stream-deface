<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div class="container mx-auto px-4 h-14 flex items-center justify-between max-w-6xl">
        <NuxtLink to="/" class="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="text-sm font-medium">返回</span>
        </NuxtLink>

        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="5" />
              <path d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2" />
            </svg>
          </div>
          <span class="font-semibold text-sm">Face Blur Pro</span>
        </div>

        <div class="w-16"></div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 container mx-auto p-4 max-w-4xl animate-fade-in">
      <Tabs default-value="capture" v-model:model-value="tabs" class="w-full">
        <TabsList class="grid w-full grid-cols-3 h-12 p-1 bg-card/50 border border-border rounded-xl mb-4">
          <TabsTrigger v-for='item in InputList' :key="item.title" :value="item.title"
            class="flex items-center justify-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <component :is="getTabIcon(item.title)" class="w-4 h-4" />
            <span class="hidden sm:inline">{{ getTabLabel(item.title) }}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent v-for='item in InputList' :key="item.title" :value="item.title" class="mt-0">
          <Card class="glass-card min-h-[400px]">
            <CardContent class="flex flex-col p-6">
              <!-- Camera Tab -->
              <div v-if="item.title == VideoType.Capture && !LoadContent"
                class="flex flex-col items-center justify-center py-12 gap-6">
                <div class="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center glow-primary">
                  <svg class="w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.5">
                    <path
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <div class="text-center">
                  <h3 class="text-lg font-semibold text-foreground mb-2">攝像頭即時串流</h3>
                  <p class="text-muted-foreground text-sm max-w-sm">選擇攝像頭並開始即時人臉偵測</p>
                </div>

                <Select @update:model-value="camChange" class="w-64">
                  <SelectTrigger class="h-11">
                    <SelectValue placeholder="選擇攝像頭" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>可用裝置</SelectLabel>
                      <SelectItem v-for="cam in cameraOption" :key="cam.deviceId" :value="cam.label">
                        {{ cam.label || '未命名攝像頭' }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button @click="handleLoadClick" :disabled="!stream" class="h-11 px-8 bg-primary hover:bg-primary/90">
                  <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21" fill="currentColor" />
                  </svg>
                  開始偵測
                </Button>
              </div>

              <!-- File Tab -->
              <div v-else-if="item.title == VideoType.File && !LoadContent"
                class="flex flex-col items-center justify-center py-12 gap-6">
                <div class="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center glow-accent">
                  <svg class="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <path d="M12 18v-6M9 15l3-3 3 3" />
                  </svg>
                </div>
                <div class="text-center">
                  <h3 class="text-lg font-semibold text-foreground mb-2">上傳影片檔案</h3>
                  <p class="text-muted-foreground text-sm max-w-sm">拖放或選擇影片檔案進行處理</p>
                </div>

                <DropZone v-model="file" class="w-full max-w-md" />

                <Button @click="handleLoadClick" :disabled="file.length === 0"
                  class="h-11 px-8 bg-accent hover:bg-accent/90 text-accent-foreground">
                  <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21" fill="currentColor" />
                  </svg>
                  開始處理
                </Button>
              </div>

              <!-- Stream Tab -->
              <div v-else-if="item.title == VideoType.Stream && !LoadContent"
                class="flex flex-col items-center justify-center py-12 gap-6">
                <div class="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center glow-primary">
                  <svg class="w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path
                      d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                </div>
                <div class="text-center">
                  <h3 class="text-lg font-semibold text-foreground mb-2">網路串流</h3>
                  <p class="text-muted-foreground text-sm max-w-sm">輸入 RTSP、HLS 或 FLV 串流網址</p>
                </div>

                <Input placeholder="輸入串流 URL" v-model="stream_url.url" class="w-full max-w-md h-11" />

                <Button @click="handleLoadClick" :disabled="!pass" class="h-11 px-8 bg-primary hover:bg-primary/90">
                  <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21" fill="currentColor" />
                  </svg>
                  連接串流
                </Button>
              </div>

              <!-- Player View -->
              <Player v-if="LoadContent" :video="video" :back="back" class="w-full" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'

const getTabIcon = (title: string) => {
  const icons: Record<string, any> = {
    'capture': h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z' })
    ]),
    'file': h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' }),
      h('polyline', { points: '14,2 14,8 20,8' })
    ]),
    'stream': h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('path', { d: 'M2 12h20' })
    ])
  }
  return icons[title] || icons['capture']
}

const getTabLabel = (title: string) => {
  const labels: Record<string, string> = {
    'capture': '攝像頭',
    'file': '檔案',
    'stream': '串流'
  }
  return labels[title] || title
}

const camChange = async (val: string) => {
  const cam = cameraOption.value?.find(value => value.label === val);
  if (cam) {
    stream.value = await getStream(cam.deviceId)
  }
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
    case VideoType.File:
      return file.value.length == 0
    case VideoType.Capture:
      return !stream.value
    default:
      return true
  }
})

import { useAsyncValidator } from '@vueuse/integrations/useAsyncValidator';
import type { Rules } from 'async-validator'

const stream = ref<MediaStream>()
const cameraOption = ref<MediaDeviceInfo[]>()

const rule: Rules = {
  url: [
    { type: 'url', required: false }
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

const tabs = ref<String>('capture')

// 切換 tab 時重置 LoadContent，讓用戶可以看到該 tab 的初始介面
watch(tabs, () => {
  LoadContent.value = false
})

const video = computed<Video>(() => {
  const type = tabs.value.toString() as VideoType
  switch (type) {
    case VideoType.Stream:
      return {
        type: VideoType.Stream,
        content: stream_url.url,
      } as StreamVideo
    case VideoType.File:
      return {
        type: VideoType.File,
        content: file.value[0].file,
      } as FileVideo
    case VideoType.Capture:
      return {
        type: VideoType.Capture,
        content: stream.value,
      } as CaptureVideo
    default:
      throw new Error(`Invalid video type: ${type}`)
  }
})

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
  try {
    sess.value = await createSession(backend.value)
    console.log('ONNX session created successfully')
  } catch (error) {
    console.error('Failed to initialize ONNX session:', error)
  }

  try {
    await navigator.mediaDevices.getUserMedia({ video: true })
    cameraOption.value = (await navigator.mediaDevices.enumerateDevices()).filter((value) => value.kind === 'videoinput')

    if (cameraOption.value.length > 0) {
      const firstCamera = cameraOption.value[0]
      stream.value = await getStream(firstCamera.deviceId)
      console.log('Camera initialized successfully')
    } else {
      console.warn('No cameras found')
    }
  } catch (error: any) {
    console.warn('Camera not available:', error.message)
  }
})

provide(onnx_provide, sess)

onUnmounted(() => {
  stream.value = undefined
})
</script>

<style></style>