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
  if (!navigator.gpu) {
    throw Error("WebGPU not supported.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw Error("Couldn't request WebGPU adapter.");
  }
  try {
    const sess = await createSession('webgpu');
    sess.release();
  } catch (error) {
    throw Error(error)
  }
  options.value.push('webgpu')
}
function testWebGL() {
  const canvas = document.createElement("canvas");
  // Initialize the GL context
  const gl = canvas.getContext("webgl");

  // Only continue if WebGL is available and working
  if (gl === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it.",
    );
    return;
  }
  options.value.push('webgl')


}




onMounted(async () => {
  await testWebGpu()
  testWebGL()
  endCheck.value = true


})
</script>


<style></style>