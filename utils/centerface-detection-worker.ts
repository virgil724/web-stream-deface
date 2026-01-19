import * as ort from 'onnxruntime-web'

let session: ort.InferenceSession | null = null
let isInitialized = false

// CenterFace model configuration
const INPUT_SIZE = 512
const SCORE_THRESHOLD = 0.5
const NMS_THRESHOLD = 0.4

// 初始化 CenterFace 檢測器
const initializeCenterFace = async (backend: string = 'webgl') => {
  try {
    // Set ONNX Runtime paths
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
      graphOptimizationLevel: 'basic' as const
    }

    // Try different centerface models
    const modelPaths = ['/centerface.onnx', '/centerface_mod2.onnx']
    
    for (const modelPath of modelPaths) {
      try {
        session = await ort.InferenceSession.create(modelPath, model_options)
        isInitialized = true
        console.log(`CenterFace model initialized in worker: ${modelPath}`)
        
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
    
    throw new Error('No valid CenterFace model found')
    
  } catch (error) {
    console.error('Failed to initialize CenterFace model in worker:', error)
    
    // 嘗試降級到純 WASM
    if (backend !== 'wasm') {
      console.log('Falling back to WASM backend in worker')
      try {
        const fallback_options = {
          executionProviders: ['wasm'],
          executionMode: 'sequential' as const,
          graphOptimizationLevel: 'basic' as const
        }
        
        const modelPaths = ['/centerface.onnx', '/centerface_mod2.onnx']
        
        for (const modelPath of modelPaths) {
          try {
            session = await ort.InferenceSession.create(modelPath, fallback_options)
            isInitialized = true
            console.log(`CenterFace model initialized with WASM fallback: ${modelPath}`)
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
    // Normalize to [-1, 1] range (common for CenterFace)
    rgbData[i] = (resizedData.data[pixelIndex] / 255.0) * 2.0 - 1.0     // R
    rgbData[i + INPUT_SIZE * INPUT_SIZE] = (resizedData.data[pixelIndex + 1] / 255.0) * 2.0 - 1.0     // G
    rgbData[i + 2 * INPUT_SIZE * INPUT_SIZE] = (resizedData.data[pixelIndex + 2] / 255.0) * 2.0 - 1.0 // B
  }
  
  return new ort.Tensor('float32', rgbData, [1, 3, INPUT_SIZE, INPUT_SIZE])
}

const postprocessDetections = (outputs: any, originalWidth: number, originalHeight: number) => {
  const faces: number[][] = []
  
  // Scale factor to convert from model coordinates to original image coordinates
  const scaleX = originalWidth / INPUT_SIZE
  const scaleY = originalHeight / INPUT_SIZE
  
  try {
    // CenterFace typically outputs heatmaps and offsets
    // This is a simplified implementation that may need adjustment based on actual model outputs
    const outputNames = Object.keys(outputs)
    console.log('CenterFace output names:', outputNames)
    
    // Try to find detection outputs
    for (const outputName of outputNames) {
      const tensor = outputs[outputName]
      if (tensor.data && tensor.dims) {
        console.log(`Output ${outputName}:`, tensor.dims, 'first few values:', Array.from(tensor.data.slice(0, 10)))
        
        // Simple heuristic: if output has spatial dimensions matching input size
        if (tensor.dims.length === 4 && tensor.dims[2] === INPUT_SIZE/4 && tensor.dims[3] === INPUT_SIZE/4) {
          // This might be a heatmap output - simplified detection
          const heatmap = tensor.data as Float32Array
          const mapSize = INPUT_SIZE / 4
          
          for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
              const idx = y * mapSize + x
              if (heatmap[idx] > SCORE_THRESHOLD) {
                // Convert to original coordinates (very basic approach)
                const centerX = (x * 4) * scaleX
                const centerY = (y * 4) * scaleY
                const size = 40 * Math.max(scaleX, scaleY) // Rough face size estimate
                
                faces.push([
                  Math.max(0, centerX - size/2),
                  Math.max(0, centerY - size/2),
                  Math.min(originalWidth, centerX + size/2),
                  Math.min(originalHeight, centerY + size/2)
                ])
              }
            }
          }
          break
        }
      }
    }
  } catch (error) {
    console.warn('Error in postprocessing CenterFace outputs:', error)
  }
  
  return faces
}

// 執行人臉檢測
const detectFaces = async (imageData: ImageData) => {
  if (!session || !isInitialized) {
    throw new Error('CenterFace model not initialized in worker')
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
    console.warn('CenterFace face detection failed in worker:', error)
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
      await initializeCenterFace(data.backend)
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
          error: 'CenterFace detector not initialized'
        })
      }
      break
      
    default:
      console.warn('Unknown message type in CenterFace worker:', type)
  }
}

self.onerror = function(error) {
  console.error('CenterFace Worker error:', error)
  self.postMessage({
    type: 'error',
    error: error.message
  })
}

// 通知主線程 worker 已準備就緒
self.postMessage({ type: 'worker-ready' })