<template>
  <video ref="videoRef" class="video-player"></video>
</template>

<script lang="ts" setup>
import { getMultiModelDetection, destroyMultiModelDetection, autoSelectBestModel, type ModelType } from '~/utils/multi-model-detection'
const { backend } = inject(backend_provide) as BackendContext
const videoRef = ref()
const props = defineProps<{
  stream: MediaStream
}>()
let multiModelDetection = null
let currentModel: ModelType | null = null
const canvas = new OffscreenCanvas(0, 0);
const ctx = canvas.getContext("2d");

const genFrame = async (dets, bitmap, timestamp) => {
  // Skip processing if no faces detected
  if (dets.length === 0) {
    return new VideoFrame(bitmap, { timestamp });
  }

  ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // Show all detected faces with red boxes for testing
  for (const det of dets) {
    const x = Math.max(0, det[0])
    const y = Math.max(0, det[1])
    const width = Math.min(canvas.width - x, det[2] - det[0])
    const height = Math.min(canvas.height - y, det[3] - det[1])
    
    if (width > 10 && height > 10) {
      // Show all faces with red boxes
      ctx.fillStyle = 'rgba(255,0,0,0.6)'
      ctx?.fillRect(x, y, width, height)
      
      // Add border for better visibility
      ctx.strokeStyle = 'rgba(255,0,0,1)'
      ctx.lineWidth = 2
      ctx?.strokeRect(x, y, width, height)
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
    multiModelDetection = getMultiModelDetection()
    currentModel = await autoSelectBestModel(backend.value)
    workerInitialized = true
    console.log(`Auto-selected detection model: ${currentModel}`)
  } catch (error) {
    console.error('Failed to initialize any face detection model:', error)
    workerInitialized = false
  }
  
  processStream()
})

onUnmounted(() => {
  // 清理 Worker 資源
  destroyMultiModelDetection()
})




</script>

<style scoped>
.video-player {
  max-width: 80vw;
  max-height: 80vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>