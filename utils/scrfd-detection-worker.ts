import * as ort from 'onnxruntime-web'

let session: ort.InferenceSession | null = null
let isInitialized = false

// SCRFD model configuration
const INPUT_SIZE = 640
const SCORE_THRESHOLD = 0.3  // Lower threshold for better detection
const NMS_THRESHOLD = 0.4

// 初始化 SCRFD 檢測器
const initializeSCRFD = async (backend: string = 'webgl') => {
  try {
    // Set ONNX Runtime WASM paths
    ort.env.wasm.wasmPaths = {
      'ort-wasm.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort-wasm.wasm',
      'ort-wasm-threaded.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort-wasm-threaded.wasm',
      'ort-wasm-simd.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort-wasm-simd.wasm',
      'ort-wasm-simd-threaded.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort-wasm-simd-threaded.wasm'
    }
    
    let executionProviders: string[]
    if (backend === 'webgpu') {
      executionProviders = ['webgpu', 'webgl', 'wasm']
      // Configure WebGPU settings
      ort.env.webgpu.validateInputContent = false
      ort.env.webgpu.powerPreference = 'high-performance'
    } else if (backend === 'webgl') {
      executionProviders = ['webgl', 'wasm']
    } else {
      executionProviders = ['wasm']
    }

    const model_options = {
      executionProviders,
      executionMode: 'sequential' as const,
      graphOptimizationLevel: 'all' as const
    }

    session = await ort.InferenceSession.create('/scrfd_2.5g.onnx', model_options)
    isInitialized = true
    console.log('SCRFD model initialized in worker')
    
    // 通知主線程初始化完成
    self.postMessage({ 
      type: 'initialized', 
      backend: backend,
      success: true 
    })
    
  } catch (error) {
    console.error('Failed to initialize SCRFD model in worker:', error)
    
    // 嘗試降級到純 WASM
    if (backend !== 'wasm') {
      console.log('Falling back to WASM backend in worker')
      try {
        const fallback_options = {
          executionProviders: ['wasm'],
          executionMode: 'sequential' as const,
          graphOptimizationLevel: 'basic' as const
        }
        session = await ort.InferenceSession.create('/scrfd_2.5g.onnx', fallback_options)
        isInitialized = true
        console.log('SCRFD model initialized with WASM fallback')
        self.postMessage({ 
          type: 'initialized', 
          backend: 'wasm',
          success: true 
        })
        return
      } catch (fallbackError) {
        console.error('WASM fallback also failed:', fallbackError)
      }
    }
    
    self.postMessage({ 
      type: 'initialized', 
      success: false, 
      error: error.message 
    })
  }
}

const preprocessImage = (imageData: ImageData): ort.Tensor => {
  const { width, height, data } = imageData
  
  // Resize to model input size
  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
  const ctx = canvas.getContext('2d')!
  
  // Create temporary canvas with original image
  const tempCanvas = new OffscreenCanvas(width, height)
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(imageData, 0, 0)
  
  // Resize to model input size
  ctx.drawImage(tempCanvas, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const resizedData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  
  // Convert to RGB and normalize
  const rgbData = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    const pixelIndex = i * 4
    rgbData[i] = resizedData.data[pixelIndex] / 255.0     // R
    rgbData[i + INPUT_SIZE * INPUT_SIZE] = resizedData.data[pixelIndex + 1] / 255.0     // G
    rgbData[i + 2 * INPUT_SIZE * INPUT_SIZE] = resizedData.data[pixelIndex + 2] / 255.0 // B
  }
  
  return new ort.Tensor('float32', rgbData, [1, 3, INPUT_SIZE, INPUT_SIZE])
}

const postprocessDetections = (outputs: any, originalWidth: number, originalHeight: number) => {
  const faces: number[][] = []
  
  // Scale factor to convert from model coordinates to original image coordinates
  const scaleX = originalWidth / INPUT_SIZE
  const scaleY = originalHeight / INPUT_SIZE
  
  try {
    // SCRFD 2.5g model typically outputs these tensors
    // The exact output format may vary, so we'll handle multiple possibilities
    const outputNames = Object.keys(outputs)
    
    let scores: Float32Array | null = null
    let boxes: Float32Array | null = null
    
    // Try to find scores and boxes in outputs
    for (const name of outputNames) {
      const tensor = outputs[name]
      if (tensor.data && tensor.dims) {
        // Heuristic to identify scores vs boxes based on dimensions
        if (tensor.dims.length >= 2 && tensor.dims[tensor.dims.length - 1] === 1) {
          // Likely scores (last dimension is 1)
          scores = tensor.data as Float32Array
        } else if (tensor.dims.length >= 2 && tensor.dims[tensor.dims.length - 1] === 4) {
          // Likely boxes (last dimension is 4 for x1,y1,x2,y2)
          boxes = tensor.data as Float32Array
        }
      }
    }
    
    if (scores && boxes) {
      const numDetections = Math.min(scores.length, boxes.length / 4)
      
      for (let i = 0; i < numDetections; i++) {
        if (scores[i] > SCORE_THRESHOLD) {
          const x1 = boxes[i * 4] * scaleX
          const y1 = boxes[i * 4 + 1] * scaleY
          const x2 = boxes[i * 4 + 2] * scaleX
          const y2 = boxes[i * 4 + 3] * scaleY
          
          // Ensure valid box coordinates
          if (x2 > x1 && y2 > y1 && x1 >= 0 && y1 >= 0) {
            faces.push([x1, y1, x2, y2])
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error in postprocessing SCRFD outputs:', error)
  }
  
  return faces
}

// 執行人臉檢測
const detectFaces = async (imageData: ImageData) => {
  if (!session || !isInitialized) {
    throw new Error('SCRFD model not initialized in worker')
  }
  
  try {
    const startTime = performance.now()
    
    // Preprocess
    const inputTensor = preprocessImage(imageData)
    
    // Run inference
    const feeds = { input: inputTensor }
    const outputs = await session.run(feeds)
    
    // Postprocess
    const detections = postprocessDetections(outputs, imageData.width, imageData.height)
    
    const detectionTime = performance.now() - startTime
    
    // 發送檢測結果
    self.postMessage({
      type: 'detection-result',
      detections,
      detectionTime,
      faceCount: detections.length
    })
    
  } catch (error) {
    console.warn('SCRFD face detection failed in worker:', error)
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
      await initializeSCRFD(data.backend)
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
          error: 'SCRFD detector not initialized'
        })
      }
      break
      
    default:
      console.warn('Unknown message type in SCRFD worker:', type)
  }
}

self.onerror = function(error) {
  console.error('SCRFD Worker error:', error)
  self.postMessage({
    type: 'error',
    error: error.message
  })
}

// 通知主線程 worker 已準備就緒
self.postMessage({ type: 'worker-ready' })