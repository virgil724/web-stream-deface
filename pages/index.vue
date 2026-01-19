<template>
  <div class="content-center w-[50vw] h-[100vh] m-auto">
    <Card>
      <CardHeader>
        <CardTitle>Auto Blur Face</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="options.length > 0 && endCheck" class="flex flex-col gap-3">
          Choose Backend
          <RadioGroup :model-value="backend" @update:model-value="updateBackend">
            <div v-for="(item) in options" class="flex items-center space-x-2">
              <RadioGroupItem :id="item" :value="item" />
              <Label :for="item">{{ item }}</Label>
            </div>

          </RadioGroup>
          <Button v-if="backend" as-child>

            <NuxtLink to="predict">Predict</NuxtLink>
          </Button>

        </div>
        <div v-else class="flex flex-col gap-3">
          <span>Checking Capability</span>
          <Progress v-model="progress" class="w-[60%]" />
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script lang="ts" setup>
import { Progress } from '~/components/ui/progress';
import type { BackendContext } from '~/utils/provide_keys';
import { createSession } from '~/utils/onnx_utils';



const progress = ref(13)
const options = ref<Array<String>>([])
const { backend, updateBackend } = inject(backend_provide) as BackendContext
const endCheck = ref(false)
watchEffect((cleanupFn) => {
  const timer = setInterval(() => {
    progress.value = (progress.value % 100) + 1
  }, 50)

  cleanupFn(() => clearInterval(timer))
})
async function testWebGpu() {
  try {
    // Check if WebGPU is available
    if (!navigator.gpu) {
      console.warn("WebGPU not supported in this browser.");
      return;
    }

    // Request adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    
    if (!adapter) {
      console.warn("Couldn't request WebGPU adapter.");
      return;
    }

    // Test device creation
    const device = await adapter.requestDevice();
    if (!device) {
      console.warn("Couldn't create WebGPU device.");
      return;
    }
    
    // Test ONNX session creation
    const sess = await createSession('webgpu');
    sess.release();
    
    // Clean up
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
  
  endCheck.value = true
})
</script>


<style></style>