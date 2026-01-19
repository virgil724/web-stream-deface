import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import '@tensorflow/tfjs-backend-cpu'
import * as faceDetection from '@tensorflow-models/face-detection'

let detector: faceDetection.FaceDetector | null = null
let isInitialized = false

// 初始化檢測器
const initializeDetector = async (backend: string = 'webgl') => {
  try {
    // 設置 TensorFlow backend (WebGPU support limited in workers)
    if (backend === 'webgpu' || backend === 'webgl') {
      // Use WebGL for both WebGPU and WebGL requests in worker context
      await tf.setBackend('webgl')
      console.log('Using WebGL backend for TensorFlow.js (WebGPU not supported in workers)')
    } else {
      await tf.setBackend('cpu')
    }
    
    await tf.ready()
    
    // 創建人臉檢測器 - 使用 full 模型提升檢測精度
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector
    const detectorConfig = {
      runtime: 'tfjs' as const,
      modelType: 'full' as const, // 使用 full 模型獲得更好檢測精度
      maxFaces: 10, // 增加檢測人數
      refineLandmarks: false,
    }
    
    detector = await faceDetection.createDetector(model, detectorConfig)
    isInitialized = true
    console.log('Face detector initialized in worker')
    
    // 通知主線程初始化完成
    self.postMessage({ 
      type: 'initialized', 
      backend: await tf.getBackend(),
      success: true 
    })
    
  } catch (error) {
    console.error('Failed to initialize face detector in worker:', error)
    
    // 嘗試 CPU 降級
    if (backend !== 'cpu') {
      console.log('Falling back to CPU backend in worker')
      await initializeDetector('cpu')
      return
    }
    
    self.postMessage({ 
      type: 'initialized', 
      success: false, 
      error: error.message 
    })
  }
}

// 執行人臉檢測
const detectFaces = async (imageData: ImageData) => {
  if (!detector || !isInitialized) {
    throw new Error('Face detector not initialized in worker')
  }
  
  try {
    const startTime = performance.now()
    
    // 創建 ImageBitmap 進行檢測
    const imageBitmap = await createImageBitmap(imageData)
    const faces = await detector.estimateFaces(imageBitmap as any)
    
    const detectionTime = performance.now() - startTime
    
    // 轉換檢測結果為座標格式
    const detections = faces.map(face => {
      const box = face.box
      return [
        box.xMin, // x1
        box.yMin, // y1  
        box.xMax, // x2
        box.yMax  // y2
      ]
    })
    
    // 清理資源
    imageBitmap.close()
    
    // 發送檢測結果
    self.postMessage({
      type: 'detection-result',
      detections,
      detectionTime,
      faceCount: faces.length
    })
    
  } catch (error) {
    console.warn('Face detection failed in worker:', error)
    self.postMessage({
      type: 'detection-result',
      detections: [],
      detectionTime: 0,
      faceCount: 0,
      error: error.message
    })
  }
}

// 監聽主線程消息
self.onmessage = async function(e) {
  const { type, data } = e.data
  
  switch (type) {
    case 'initialize':
      await initializeDetector(data.backend)
      break
      
    case 'detect':
      if (isInitialized) {
        await detectFaces(data.imageData)
      } else {
        self.postMessage({
          type: 'detection-result',
          detections: [],
          detectionTime: 0,
          faceCount: 0,
          error: 'Detector not initialized'
        })
      }
      break
      
    default:
      console.warn('Unknown message type in worker:', type)
  }
}

self.onerror = function(error) {
  console.error('Worker error:', error)
  self.postMessage({
    type: 'error',
    error: error.message
  })
}

// 通知主線程 worker 已準備就緒
self.postMessage({ type: 'worker-ready' })