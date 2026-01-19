import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import '@tensorflow/tfjs-backend-cpu'
import * as faceDetection from '@tensorflow-models/face-detection'

let detector: faceDetection.FaceDetector | null = null

export const initializeFaceDetector = async (backend: string = 'webgl') => {
  try {
    // Set TensorFlow backend
    if (backend === 'webgl') {
      await tf.setBackend('webgl')
    } else {
      await tf.setBackend('cpu')
    }
    
    await tf.ready()
    
    // Optimized face detector config for performance
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector
    const detectorConfig = {
      runtime: 'tfjs' as const,
      modelType: 'short' as const, // Use 'short' for better performance
      maxFaces: 10, // Reduced for better performance
      refineLandmarks: false, // Disable landmarks for speed
    }
    
    detector = await faceDetection.createDetector(model, detectorConfig)
    console.log('Face detector initialized successfully')
    return detector
  } catch (error) {
    console.error('Failed to initialize face detector:', error)
    // Fallback to CPU
    if (backend !== 'cpu') {
      console.log('Falling back to CPU backend')
      await tf.setBackend('cpu')
      await tf.ready()
      
      const model = faceDetection.SupportedModels.MediaPipeFaceDetector
      const detectorConfig = {
        runtime: 'tfjs' as const,
        modelType: 'short' as const,
        maxFaces: 10,
        refineLandmarks: false,
      }
      
      detector = await faceDetection.createDetector(model, detectorConfig)
      return detector
    }
    throw error
  }
}

export const detectFaces = async (videoFrame: VideoFrame | ImageBitmap) => {
  if (!detector) {
    throw new Error('Face detector not initialized')
  }
  
  try {
    const faces = await detector.estimateFaces(videoFrame as any)
    // Reduced debug logging for performance
    if (faces.length > 0) console.log(`Detected ${faces.length} faces`)
    return faces.map(face => {
      const box = face.box
      return [
        box.xMin, // x1
        box.yMin, // y1  
        box.xMax, // x2
        box.yMax  // y2
      ]
    })
  } catch (error) {
    console.warn('Face detection failed:', error)
    return []
  }
}

export const getFaceDetector = () => detector