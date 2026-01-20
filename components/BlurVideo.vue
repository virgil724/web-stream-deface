<template>
  <div class="blur-video-container">
    <!-- Loading Overlay -->
    <div v-if="isModelLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
        <div class="loading-text">
          <span class="loading-title">🔒 遮蔽功能啟動中</span>
          <span class="loading-subtitle">{{ loadingMessage }}</span>
        </div>
      </div>
    </div>
    <video ref="videoRef" class="video-player"></video>
  </div>
</template>

<script lang="ts" setup>
import { getMultiModelDetection, destroyMultiModelDetection, autoSelectBestModel, type ModelType } from '~/utils/multi-model-detection'
import type { MaskType } from '~/utils/mask-types'

const { backend } = inject(backend_provide) as BackendContext
const videoRef = ref()
const props = defineProps<{
  stream: MediaStream
  maskType?: MaskType
}>()

let multiModelDetection = null
let currentModel: ModelType | null = null
const canvas = new OffscreenCanvas(0, 0);
const ctx = canvas.getContext("2d");

// Loading state
const isModelLoading = ref(true)
const loadingMessage = ref('正在載入人臉偵測模型...')

// Emoji options for face masking
const emojiList = ['😀', '😎', '🙂', '😊', '🤖', '👽', '🎭', '🐱']

// Apply blur effect to a region
const applyBlur = (x: number, y: number, width: number, height: number) => {
  if (!ctx) return
  // Use pixelation as blur approximation (OffscreenCanvas doesn't support filter)
  const pixelSize = Math.max(8, Math.floor(Math.min(width, height) / 8))
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  for (let py = 0; py < height; py += pixelSize) {
    for (let px = 0; px < width; px += pixelSize) {
      let r = 0, g = 0, b = 0, count = 0

      for (let dy = 0; dy < pixelSize && py + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && px + dx < width; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
      }

      r = Math.floor(r / count)
      g = Math.floor(g / count)
      b = Math.floor(b / count)

      for (let dy = 0; dy < pixelSize && py + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && px + dx < width; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4
          data[i] = r
          data[i + 1] = g
          data[i + 2] = b
        }
      }
    }
  }

  ctx.putImageData(imageData, x, y)
}

// Apply pixelate effect
const applyPixelate = (x: number, y: number, width: number, height: number) => {
  if (!ctx) return
  const pixelSize = Math.max(12, Math.floor(Math.min(width, height) / 6))
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  for (let py = 0; py < height; py += pixelSize) {
    for (let px = 0; px < width; px += pixelSize) {
      const i = (py * width + px) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]

      for (let dy = 0; dy < pixelSize && py + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && px + dx < width; dx++) {
          const j = ((py + dy) * width + (px + dx)) * 4
          data[j] = r
          data[j + 1] = g
          data[j + 2] = b
        }
      }
    }
  }

  ctx.putImageData(imageData, x, y)
}

// Apply solid color block
const applySolid = (x: number, y: number, width: number, height: number) => {
  if (!ctx) return
  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)'
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, width, height)
}

// Apply emoji mask
const applyEmoji = (x: number, y: number, width: number, height: number, faceIndex: number) => {
  if (!ctx) return
  const emoji = emojiList[faceIndex % emojiList.length]
  const size = Math.min(width, height)
  ctx.font = `${size}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, x + width / 2, y + height / 2)
}

const genFrame = async (dets: number[][], bitmap: ImageBitmap, timestamp: number) => {
  if (dets.length === 0) {
    return new VideoFrame(bitmap, { timestamp });
  }

  ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const maskType = props.maskType || 'blur'

  for (let i = 0; i < dets.length; i++) {
    const det = dets[i]
    const x = Math.max(0, Math.floor(det[0]))
    const y = Math.max(0, Math.floor(det[1]))
    const width = Math.min(canvas.width - x, Math.floor(det[2] - det[0]))
    const height = Math.min(canvas.height - y, Math.floor(det[3] - det[1]))

    if (width > 10 && height > 10) {
      switch (maskType) {
        case 'blur':
          applyBlur(x, y, width, height)
          break
        case 'pixelate':
          applyPixelate(x, y, width, height)
          break
        case 'solid':
          applySolid(x, y, width, height)
          break
        case 'emoji':
          applyEmoji(x, y, width, height, i)
          break
        default:
          applyBlur(x, y, width, height)
      }
    }
  }

  const newBitmap = await createImageBitmap(canvas);
  return new VideoFrame(newBitmap, { timestamp });
}
let frameCounter = 0
let lastDetections = []
let processingFrame = false
let lastCanvasSize = { width: 0, height: 0 }
let detectionTimes = []
let lastLogTime = Date.now()
let workerInitialized = false

const transformer = new TransformStream({
  async transform(videoFrame: VideoFrame, controller) {
    frameCounter++

    const bitmap = await createImageBitmap(videoFrame)
    const timestamp = videoFrame.timestamp
    const { width, height } = videoFrame.codedRect as { width: number, height: number }

    // Only resize canvas if dimensions changed
    if (lastCanvasSize.width !== width || lastCanvasSize.height !== height) {
      canvas.width = width
      canvas.height = height
      lastCanvasSize = { width, height }
    }

    let dets = lastDetections

    // Real-time detection for immediate response
    if (!processingFrame) {
      processingFrame = true
      try {
        const startTime = performance.now()

        // Use full resolution for maximum accuracy
        const detectBitmap = await createImageBitmap(videoFrame)

        // Create ImageData for worker
        const tempCanvas = new OffscreenCanvas(detectBitmap.width, detectBitmap.height)
        const tempCtx = tempCanvas.getContext('2d')
        tempCtx?.drawImage(detectBitmap, 0, 0)
        const imageData = tempCtx?.getImageData(0, 0, detectBitmap.width, detectBitmap.height)

        let detectionTime = 0
        if (imageData && multiModelDetection && workerInitialized) {
          const result = await multiModelDetection.detectFaces(imageData)
          dets = result.detections
          // No scaling needed - using original resolution
          // Use worker's detection time for accuracy
          detectionTime = result.detectionTime
        } else {
          dets = []
          detectionTime = performance.now() - startTime
        }

        detectionTimes.push(detectionTime)
        lastDetections = dets
        detectBitmap.close()

        // Log performance stats every 5 seconds
        const now = Date.now()
        if (now - lastLogTime > 5000) {
          const avgTime = detectionTimes.reduce((a, b) => a + b, 0) / detectionTimes.length
          const effectiveFPS = Math.round(1000 / avgTime) // Real-time detection FPS
          console.log(`🚀 Multi-Model Detection Stats (${currentModel}):`)
          console.log(`  - Faces detected: ${dets.length}`)
          console.log(`  - Avg detection time: ${avgTime.toFixed(2)}ms`)
          console.log(`  - Detection mode: Real-time (full resolution)`)
          console.log(`  - Effective video FPS: ~${effectiveFPS}`)
          console.log(`  - Frame resolution: ${width}x${height}`)
          console.log(`  - Worker initialized: ${workerInitialized}`)
          detectionTimes = []
          lastLogTime = now
        }

        videoFrame.close();
      } catch (error) {
        console.warn('Face detection failed:', error)
        dets = []
        videoFrame.close();
      } finally {
        processingFrame = false
      }
    } else {
      // Use cached detections for smooth video
      dets = lastDetections
      videoFrame.close();
    }

    const newFrame = await genFrame(
      dets,
      bitmap,
      timestamp,
    );
    bitmap.close();
    controller.enqueue(newFrame);

  },
  flush(controller) {
    controller.terminate();
  }


})

const processStream = () => {
  const videoTrack = props.stream.getVideoTracks()[0]

  const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack })
  const trackGenerator = new MediaStreamTrackGenerator({ kind: "video" })
  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);

  const processedStream = new MediaStream();
  processedStream.addTrack(trackGenerator);

  videoRef.value.addEventListener("loadedmetadata", () => {
    videoRef.value?.play();
  });
  videoRef.value.srcObject = processedStream;
}

onMounted(async () => {
  try {
    isModelLoading.value = true
    loadingMessage.value = '正在載入人臉偵測模型...'

    multiModelDetection = getMultiModelDetection()

    loadingMessage.value = '正在選擇最佳模型...'
    currentModel = await autoSelectBestModel(backend.value)

    loadingMessage.value = '模型載入完成！'
    workerInitialized = true
    console.log(`Auto-selected detection model: ${currentModel}`)

    // Short delay to show completion message
    await new Promise(resolve => setTimeout(resolve, 300))
    isModelLoading.value = false
  } catch (error) {
    console.error('Failed to initialize any face detection model:', error)
    loadingMessage.value = '模型載入失敗，請重試'
    workerInitialized = false
    // Keep loading overlay visible for 2 seconds on error
    await new Promise(resolve => setTimeout(resolve, 2000))
    isModelLoading.value = false
  }

  processStream()
})

onUnmounted(() => {
  // 清理 Worker 資源
  destroyMultiModelDetection()
})





</script>

<style scoped>
.blur-video-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 10;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.loading-spinner {
  position: relative;
  width: 64px;
  height: 64px;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-radius: 50%;
  animation: spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
}

.spinner-ring:nth-child(1) {
  border-top-color: hsl(217, 91%, 60%);
  animation-delay: 0s;
}

.spinner-ring:nth-child(2) {
  width: 80%;
  height: 80%;
  top: 10%;
  left: 10%;
  border-right-color: hsl(270, 91%, 60%);
  animation-delay: 0.15s;
  animation-direction: reverse;
}

.spinner-ring:nth-child(3) {
  width: 60%;
  height: 60%;
  top: 20%;
  left: 20%;
  border-bottom-color: hsl(326, 91%, 60%);
  animation-delay: 0.3s;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.loading-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
  letter-spacing: 0.025em;
}

.loading-subtitle {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}
</style>