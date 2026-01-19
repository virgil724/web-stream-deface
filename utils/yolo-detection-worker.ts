import * as ort from 'onnxruntime-web'

let session: ort.InferenceSession | null = null
let isInitialized = false
let currentModel = ''

// YOLO model configuration
const INPUT_SIZE = 640
const SCORE_THRESHOLD = 0.4  // Confidence threshold
const NMS_THRESHOLD = 0.5    // Non-maximum suppression threshold

// 初始化 YOLO 檢測器
const initializeYOLO = async (backend: string = 'webgl') => {
  try {
    // Set ONNX Runtime paths
    ort.env.wasm.wasmPaths = {
      'ort-wasm.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort-wasm.wasm',
      'ort-wasm-threaded.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort-wasm-threaded.wasm',
      'ort-wasm-simd.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort-wasm-simd.wasm',
      'ort-wasm-simd-threaded.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort-wasm-simd-threaded.wasm'
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
      graphOptimizationLevel: 'basic' as const
    }

    // Try YOLO models in order of preference (newer = better)
    const modelPaths = [
      '/yolov11n-face.onnx',  // Latest and best
      '/yolov10n-face.onnx',  // Good performance
      '/yolov8n-face.onnx'    // Reliable fallback
    ]
    
    for (const modelPath of modelPaths) {
      try {
        session = await ort.InferenceSession.create(modelPath, model_options)
        currentModel = modelPath
        isInitialized = true
        console.log(`YOLO model initialized in worker: ${modelPath}`)
        
        self.postMessage({ 
          type: 'initialized', 
          backend: backend,
          success: true,
          model: modelPath
        })
        return
      } catch (modelError) {
        console.warn(`Failed to load ${modelPath}:`, modelError)
      }
    }
    
    throw new Error('No valid YOLO model found')
    
  } catch (error) {
    console.error('Failed to initialize YOLO model in worker:', error)
    
    // 嘗試降級到純 WASM
    if (backend !== 'wasm') {
      console.log('Falling back to WASM backend in worker')
      try {
        const fallback_options = {
          executionProviders: ['wasm'],
          executionMode: 'sequential' as const,
          graphOptimizationLevel: 'basic' as const
        }
        
        const modelPaths = ['/yolov11n-face.onnx', '/yolov10n-face.onnx', '/yolov8n-face.onnx']
        
        for (const modelPath of modelPaths) {
          try {
            session = await ort.InferenceSession.create(modelPath, fallback_options)
            currentModel = modelPath
            isInitialized = true
            console.log(`YOLO model initialized with WASM fallback: ${modelPath}`)
            self.postMessage({ 
              type: 'initialized', 
              backend: 'wasm',
              success: true,
              model: modelPath
            })
            return
          } catch (modelError) {
            console.warn(`WASM fallback failed for ${modelPath}:`, modelError)
          }
        }
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
  const { width, height } = imageData
  
  // Create canvas for resizing
  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
  const ctx = canvas.getContext('2d')!
  
  // Create temporary canvas with original image
  const tempCanvas = new OffscreenCanvas(width, height)
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(imageData, 0, 0)
  
  // Resize maintaining aspect ratio with padding
  const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height)
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  const x = (INPUT_SIZE - scaledWidth) / 2
  const y = (INPUT_SIZE - scaledHeight) / 2
  
  // Fill with gray background and draw scaled image
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(tempCanvas, 0, 0, width, height, x, y, scaledWidth, scaledHeight)
  
  const resizedData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  
  // Convert to CHW format and normalize to [0,1]
  const rgbData = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    const pixelIndex = i * 4
    rgbData[i] = resizedData.data[pixelIndex] / 255.0                           // R
    rgbData[i + INPUT_SIZE * INPUT_SIZE] = resizedData.data[pixelIndex + 1] / 255.0     // G
    rgbData[i + 2 * INPUT_SIZE * INPUT_SIZE] = resizedData.data[pixelIndex + 2] / 255.0 // B
  }
  
  return new ort.Tensor('float32', rgbData, [1, 3, INPUT_SIZE, INPUT_SIZE])
}

const postprocessYOLO = (outputs: any, originalWidth: number, originalHeight: number): number[][] => {
  const faces: number[][] = []
  
  // Calculate scale factors
  const scale = Math.min(INPUT_SIZE / originalWidth, INPUT_SIZE / originalHeight)
  const padX = (INPUT_SIZE - originalWidth * scale) / 2
  const padY = (INPUT_SIZE - originalHeight * scale) / 2
  
  try {
    // Get the main output tensor
    const outputNames = Object.keys(outputs)
    const outputTensor = outputs[outputNames[0]]
    
    if (!outputTensor || !outputTensor.data) {
      console.warn('No valid YOLO output found')
      return faces
    }
    
    const outputData = outputTensor.data as Float32Array
    const [batchSize, channels, numDetections] = outputTensor.dims
    
    console.log(`YOLO output shape: [${outputTensor.dims.join(', ')}]`)
    
    // Process detections
    for (let i = 0; i < numDetections; i++) {
      // Extract bbox and confidence based on YOLO format
      let x, y, w, h, confidence
      
      if (channels === 6) {
        // YOLOv8/v10/v11 format: [x, y, w, h, confidence, class_prob]
        x = outputData[i]
        y = outputData[i + numDetections]
        w = outputData[i + 2 * numDetections]
        h = outputData[i + 3 * numDetections]
        confidence = outputData[i + 4 * numDetections]
      } else if (channels >= 5) {
        // Alternative format: [x, y, w, h, confidence, ...]
        x = outputData[i]
        y = outputData[i + numDetections]
        w = outputData[i + 2 * numDetections]
        h = outputData[i + 3 * numDetections]
        confidence = outputData[i + 4 * numDetections]
      } else {
        continue // Skip if format not recognized
      }
      
      if (confidence > SCORE_THRESHOLD) {
        // Convert from center format to corner format
        const x1 = (x - w / 2 - padX) / scale
        const y1 = (y - h / 2 - padY) / scale
        const x2 = (x + w / 2 - padX) / scale
        const y2 = (y + h / 2 - padY) / scale
        
        // Clamp to image bounds
        const clampedX1 = Math.max(0, Math.min(x1, originalWidth))
        const clampedY1 = Math.max(0, Math.min(y1, originalHeight))
        const clampedX2 = Math.max(0, Math.min(x2, originalWidth))
        const clampedY2 = Math.max(0, Math.min(y2, originalHeight))
        
        if (clampedX2 > clampedX1 && clampedY2 > clampedY1) {
          faces.push([clampedX1, clampedY1, clampedX2, clampedY2])
        }
      }
    }
  } catch (error) {
    console.warn('Error in postprocessing YOLO outputs:', error)
  }
  
  return faces
}

// 執行人臉檢測
const detectFaces = async (imageData: ImageData) => {
  if (!session || !isInitialized) {
    throw new Error('YOLO model not initialized in worker')
  }
  
  try {
    const startTime = performance.now()
    
    // Preprocess
    const inputTensor = preprocessImage(imageData)
    
    // Run inference
    const feeds = { images: inputTensor }
    const outputs = await session.run(feeds)
    
    // Postprocess
    const detections = postprocessYOLO(outputs, imageData.width, imageData.height)
    
    const detectionTime = performance.now() - startTime
    
    // 發送檢測結果
    self.postMessage({
      type: 'detection-result',
      detections,
      detectionTime,
      faceCount: detections.length
    })
    
  } catch (error) {
    console.warn('YOLO face detection failed in worker:', error)
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
      await initializeYOLO(data.backend)
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
          error: 'YOLO detector not initialized'
        })
      }
      break
      
    default:
      console.warn('Unknown message type in YOLO worker:', type)
  }
}

self.onerror = function(error) {
  console.error('YOLO Worker error:', error)
  self.postMessage({
    type: 'error',
    error: error.message
  })
}

// 通知主線程 worker 已準備就緒
self.postMessage({ type: 'worker-ready' })