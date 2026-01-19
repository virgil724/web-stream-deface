import * as ort from 'onnxruntime-web'

let session: ort.InferenceSession | null = null

// SCRFD model configuration
const INPUT_SIZE = 640
const SCORE_THRESHOLD = 0.5
const NMS_THRESHOLD = 0.4

export const initializeSCRFD = async (backend: string = 'webgl') => {
  try {
    // Set ONNX Runtime backend
    if (backend === 'webgl') {
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/"
    }

    const model_options = {
      executionProviders: backend === 'webgl' ? ['webgl'] : ['wasm'],
      executionMode: 'sequential' as const,
      graphOptimizationLevel: 'all' as const
    }

    // We'll use a publicly available SCRFD model or download from the repo
    // For now, let's try to use a lightweight version
    session = await ort.InferenceSession.create('/scrfd_2.5g.onnx', model_options)
    console.log('SCRFD model initialized successfully')
    return session
  } catch (error) {
    console.error('Failed to initialize SCRFD model:', error)
    // Fallback to CPU
    if (backend !== 'cpu') {
      console.log('Falling back to CPU backend')
      const model_options = {
        executionProviders: ['wasm'],
        executionMode: 'sequential' as const,
        graphOptimizationLevel: 'all' as const
      }
      session = await ort.InferenceSession.create('/scrfd_2.5g.onnx', model_options)
      return session
    }
    throw error
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

const postprocessDetections = (output: any, originalWidth: number, originalHeight: number) => {
  // SCRFD typically outputs scores and boxes
  // This is a simplified version - actual implementation would depend on the specific model output format
  const faces: number[][] = []
  
  // Scale factor to convert from model coordinates to original image coordinates
  const scaleX = originalWidth / INPUT_SIZE
  const scaleY = originalHeight / INPUT_SIZE
  
  // Extract detections (format may vary based on specific SCRFD model)
  // This is a placeholder implementation - would need to be adjusted based on actual model output
  if (output.scores && output.boxes) {
    const scores = output.scores.data
    const boxes = output.boxes.data
    
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > SCORE_THRESHOLD) {
        const x1 = boxes[i * 4] * scaleX
        const y1 = boxes[i * 4 + 1] * scaleY
        const x2 = boxes[i * 4 + 2] * scaleX
        const y2 = boxes[i * 4 + 3] * scaleY
        
        faces.push([x1, y1, x2, y2])
      }
    }
  }
  
  return faces
}

export const detectFacesSCRFD = async (videoFrame: VideoFrame | ImageBitmap) => {
  if (!session) {
    throw new Error('SCRFD model not initialized')
  }
  
  try {
    // Convert to ImageData
    const canvas = new OffscreenCanvas(videoFrame.width, videoFrame.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(videoFrame, 0, 0)
    const imageData = ctx.getImageData(0, 0, videoFrame.width, videoFrame.height)
    
    // Preprocess
    const inputTensor = preprocessImage(imageData)
    
    // Run inference
    const feeds = { input: inputTensor }
    const output = await session.run(feeds)
    
    // Postprocess
    const faces = postprocessDetections(output, videoFrame.width, videoFrame.height)
    
    console.log(`SCRFD detected ${faces.length} faces`)
    return faces
    
  } catch (error) {
    console.warn('SCRFD face detection failed:', error)
    return []
  }
}

export const getSCRFDSession = () => session