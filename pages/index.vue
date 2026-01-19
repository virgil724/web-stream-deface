<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-lg animate-fade-in">
      <!-- Branding -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 glow-primary">
          <svg class="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="8" r="5"/>
            <path d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2"/>
            <path d="M8 8h8" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-foreground mb-2">Face Blur Pro</h1>
        <p class="text-muted-foreground">即時人臉偵測與遮蔽處理，支援多種視訊來源</p>
      </div>

      <!-- Main Card -->
      <Card class="glass-card">
        <CardHeader class="text-center pb-2">
          <CardTitle class="text-lg">選擇運算後端</CardTitle>
          <CardDescription>系統將自動偵測可用的硬體加速選項</CardDescription>
        </CardHeader>
        <CardContent>
          <!-- Loading State -->
          <div v-if="!endCheck" class="space-y-4">
            <div class="flex items-center justify-center gap-3 py-4">
              <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span class="text-muted-foreground">正在檢測 GPU 功能...</span>
            </div>
            <Progress v-model="progress" class="h-2" />
          </div>

          <!-- Backend Selection -->
          <div v-else class="space-y-4">
            <RadioGroup :model-value="backend" @update:model-value="updateBackend" class="grid gap-3">
              <div v-for="item in options" :key="item" 
                   class="relative">
                <RadioGroupItem :id="item" :value="item" class="peer sr-only" />
                <Label :for="item" 
                       class="flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-card/50 
                              cursor-pointer transition-all duration-200
                              hover:border-primary/50 hover:bg-card
                              peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10
                              peer-data-[state=checked]:glow-primary">
                  <!-- Backend Icon -->
                  <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                       :class="getBackendIconClass(item)">
                    <component :is="getBackendIcon(item)" class="w-5 h-5" />
                  </div>
                  <!-- Backend Info -->
                  <div class="flex-1">
                    <div class="font-semibold text-foreground">{{ getBackendName(item) }}</div>
                    <div class="text-sm text-muted-foreground">{{ getBackendDesc(item) }}</div>
                  </div>
                  <!-- Check Icon -->
                  <div v-if="backend === item" class="flex-shrink-0">
                    <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <!-- CTA Button -->
            <Button v-if="backend" as-child class="w-full h-12 text-base font-semibold mt-6 bg-primary hover:bg-primary/90">
              <NuxtLink to="predict" class="flex items-center justify-center gap-2">
                開始使用
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </NuxtLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Footer -->
      <div class="text-center mt-6 text-sm text-muted-foreground">
        支援 YOLO、SCRFD、CenterFace、MediaPipe 多種偵測模型
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import { Progress } from '~/components/ui/progress';
import type { BackendContext } from '~/utils/provide_keys';
import { createSession } from '~/utils/onnx_utils';

const progress = ref(13)
const options = ref<Array<String>>([])
const { backend, updateBackend } = inject(backend_provide) as BackendContext
const endCheck = ref(false)

// Backend display helpers
const getBackendName = (item: string) => {
  const names: Record<string, string> = {
    'webgpu': 'WebGPU',
    'webgl': 'WebGL',
    'cpu': 'CPU'
  }
  return names[item] || item.toUpperCase()
}

const getBackendDesc = (item: string) => {
  const descs: Record<string, string> = {
    'webgpu': '最新 GPU 加速技術，效能最佳',
    'webgl': 'GPU 加速，廣泛瀏覽器支援',
    'cpu': '軟體運算，相容性最高'
  }
  return descs[item] || ''
}

const getBackendIconClass = (item: string) => {
  const classes: Record<string, string> = {
    'webgpu': 'bg-primary/20 text-primary',
    'webgl': 'bg-accent/20 text-accent',
    'cpu': 'bg-muted text-muted-foreground'
  }
  return classes[item] || 'bg-muted text-muted-foreground'
}

const getBackendIcon = (item: string) => {
  // GPU icon for webgpu/webgl, CPU icon for cpu
  if (item === 'cpu') {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }),
      h('rect', { x: '9', y: '9', width: '6', height: '6' }),
      h('path', { d: 'M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3' })
    ])
  }
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { d: 'M6 18L18 6M6 6l12 12', 'stroke-linecap': 'round' }),
    h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' })
  ])
}

watchEffect((cleanupFn) => {
  const timer = setInterval(() => {
    progress.value = (progress.value % 100) + 2
  }, 50)
  cleanupFn(() => clearInterval(timer))
})

async function testWebGpu() {
  try {
    if (!navigator.gpu) {
      console.warn("WebGPU not supported in this browser.");
      return;
    }
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    if (!adapter) {
      console.warn("Couldn't request WebGPU adapter.");
      return;
    }
    const device = await adapter.requestDevice();
    if (!device) {
      console.warn("Couldn't create WebGPU device.");
      return;
    }
    const sess = await createSession('webgpu');
    sess.release();
    device.destroy();
    options.value.push('webgpu')
    console.log("WebGPU backend available and working");
  } catch (error) {
    console.warn("WebGPU backend test failed:", error);
  }
}

async function testWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (gl === null) {
      console.warn("WebGL not supported");
      return;
    }
    const sess = await createSession('webgl');
    sess.release();
    options.value.push('webgl')
    console.log("WebGL backend available");
  } catch (error) {
    console.warn("WebGL backend failed:", error);
  }
}

onMounted(async () => {
  await testWebGpu()
  await testWebGL()
  
  if (options.value.length === 0) {
    console.log("Falling back to CPU backend");
    options.value.push('cpu')
  }
  
  // Auto-select first available backend
  if (options.value.length > 0 && !backend.value) {
    updateBackend(options.value[0] as string)
  }
  
  endCheck.value = true
})
</script>

<style></style>