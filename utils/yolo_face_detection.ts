import * as ort from 'onnxruntime-web'

let session: ort.InferenceSession | null = null

export const initializeYOLOFace = async (backend: string = 'webgl') => {
  try {
    // Set ONNX Runtime backend
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/"

    const model_options = {
      executionProviders: backend === 'webgl' ? ['webgl'] : ['wasm'],
      executionMode: 'sequential' as const,
      graphOptimizationLevel: 'all' as const
    }

    // Use YOLOv8n face detection model - much better than MediaPipe
    // This is a lightweight YOLO model specifically trained for face detection
    session = await ort.InferenceSession.create('/yolov8n-face.onnx', model_options)
    console.log('YOLOv8n Face model initialized successfully')
    return session
  } catch (error) {
    console.error('Failed to initialize YOLOv8n Face model:', error)
    // Fallback to CPU
    if (backend !== 'cpu') {
      console.log('Falling back to CPU backend')
      const model_options = {
        executionProviders: ['wasm'],
        executionMode: 'sequential' as const,
        graphOptimizationLevel: 'all' as const
      }
      session = await ort.InferenceSession.create('/yolov8n-face.onnx', model_options)
      return session
    }
    throw error
  }
}

const preprocessImage = (imageData: ImageData, inputSize: number = 640): ort.Tensor => {
  const { width, height } = imageData
  
  // Create canvas for resizing
  const canvas = new OffscreenCanvas(inputSize, inputSize)
  const ctx = canvas.getContext('2d')!
  
  // Create temporary canvas with original image
  const tempCanvas = new OffscreenCanvas(width, height)
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(imageData, 0, 0)
  
  // Resize maintaining aspect ratio with padding
  const scale = Math.min(inputSize / width, inputSize / height)
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  const x = (inputSize - scaledWidth) / 2
  const y = (inputSize - scaledHeight) / 2
  
  // Fill with gray background and draw scaled image
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, inputSize, inputSize)
  ctx.drawImage(tempCanvas, 0, 0, width, height, x, y, scaledWidth, scaledHeight)
  
  const resizedData = ctx.getImageData(0, 0, inputSize, inputSize)
  
  // Convert to CHW format and normalize to [0,1]
  const rgbData = new Float32Array(3 * inputSize * inputSize)
  
  for (let i = 0; i < inputSize * inputSize; i++) {
    const pixelIndex = i * 4
    rgbData[i] = resizedData.data[pixelIndex] / 255.0                           // R
    rgbData[i + inputSize * inputSize] = resizedData.data[pixelIndex + 1] / 255.0     // G
    rgbData[i + 2 * inputSize * inputSize] = resizedData.data[pixelIndex + 2] / 255.0 // B
  }
  
  return new ort.Tensor('float32', rgbData, [1, 3, inputSize, inputSize])
}

const postprocessYOLO = (output: any, originalWidth: number, originalHeight: number, inputSize: number = 640): number[][] => {
  const faces: number[][] = []
  
  // Calculate scale factors
  const scale = Math.min(inputSize / originalWidth, inputSize / originalHeight)
  const padX = (inputSize - originalWidth * scale) / 2
  const padY = (inputSize - originalHeight * scale) / 2
  
  // YOLO output format: [batch, 84, 8400] where 84 = 4 (bbox) + 80 (classes)
  // For face detection, we only care about face class
  if (output && output.data) {
    const outputData = output.data
    const numDetections = output.dims[2] // 8400
    
    for (let i = 0; i < numDetections; i++) {
      // Extract bbox and confidence
      const x = outputData[i] // center x
      const y = outputData[i + numDetections] // center y
      const w = outputData[i + 2 * numDetections] // width
      const h = outputData[i + 3 * numDetections] // height
      
      // Face confidence (assuming face is class 0)
      const confidence = outputData[i + 4 * numDetections]
      
      if (confidence > 0.5) {
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
  }
  
  return faces
}

export const detectFacesYOLO = async (videoFrame: VideoFrame | ImageBitmap): Promise<number[][]> => {
  if (!session) {
    throw new Error('YOLOv8n Face model not initialized')
  }
  
  try {
    // Convert to ImageData
    const canvas = new OffscreenCanvas(videoFrame.width, videoFrame.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(videoFrame, 0, 0)
    const imageData = ctx.getImageData(0, 0, videoFrame.width, videoFrame.height)
    
    // Preprocess
    const inputTensor = preprocessImage(imageData, 640)
    
    // Run inference
    const feeds = { images: inputTensor }
    const output = await session.run(feeds)
    
    // Get the output tensor (usually named 'output0' or similar)
    const outputTensor = output[Object.keys(output)[0]]
    
    // Postprocess
    const faces = postprocessYOLO(outputTensor, videoFrame.width, videoFrame.height, 640)
    
    console.log(`YOLOv8n detected ${faces.length} faces`)
    return faces
    
  } catch (error) {
    console.warn('YOLOv8n face detection failed:', error)
    return []
  }
}

export const getYOLOSession = () => session