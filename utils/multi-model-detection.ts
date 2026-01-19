// 多模型選擇器
import { getFaceDetectionWorker, destroyFaceDetectionWorker } from './worker-face-detection'
import { getSCRFDDetectionWorker, destroySCRFDDetectionWorker } from './scrfd-worker-manager'
import { getCenterFaceDetectionWorker, destroyCenterFaceDetectionWorker } from './centerface-worker-manager'
import { getYOLODetectionWorker, destroyYOLODetectionWorker } from './yolo-worker-manager'

export type ModelType = 'yolo' | 'scrfd' | 'centerface' | 'mediapipe'

export interface DetectionWorker {
  initialize(backend: string): Promise<void>
  detectFaces(imageData: ImageData): Promise<{
    detections: number[][]
    detectionTime: number
    faceCount: number
  }>
  initialized: boolean
  destroy(): void
}

export class MultiModelDetection {
  private currentWorker: DetectionWorker | null = null
  private currentModel: ModelType | null = null
  
  async switchModel(modelType: ModelType, backend: string = 'webgpu'): Promise<boolean> {
    try {
      // 清理現有的 worker
      this.cleanup()
      
      // 創建新的 worker
      switch (modelType) {
        case 'yolo':
          this.currentWorker = getYOLODetectionWorker()
          break
        case 'scrfd':
          this.currentWorker = getSCRFDDetectionWorker()
          break
        case 'centerface':
          this.currentWorker = getCenterFaceDetectionWorker()
          break
        case 'mediapipe':
          this.currentWorker = getFaceDetectionWorker()
          break
        default:
          throw new Error(`Unknown model type: ${modelType}`)
      }
      
      // 初始化新的 worker
      await this.currentWorker.initialize(backend)
      this.currentModel = modelType
      
      console.log(`Successfully switched to ${modelType} model`)
      return true
      
    } catch (error) {
      console.error(`Failed to switch to ${modelType} model:`, error)
      
      // 如果失敗，嘗試降級到 MediaPipe
      if (modelType !== 'mediapipe') {
        console.log('Falling back to MediaPipe model')
        const fallbackSuccess = await this.switchModel('mediapipe', backend)
        if (fallbackSuccess) {
          this.currentModel = 'mediapipe' // 確保正確設置當前模型
        }
        return fallbackSuccess
      }
      
      return false
    }
  }
  
  async detectFaces(imageData: ImageData) {
    if (!this.currentWorker || !this.currentWorker.initialized) {
      throw new Error('No model initialized')
    }
    
    return this.currentWorker.detectFaces(imageData)
  }
  
  getCurrentModel(): ModelType | null {
    return this.currentModel
  }
  
  isInitialized(): boolean {
    return this.currentWorker ? this.currentWorker.initialized : false
  }
  
  private cleanup() {
    if (this.currentWorker) {
      switch (this.currentModel) {
        case 'yolo':
          destroyYOLODetectionWorker()
          break
        case 'scrfd':
          destroySCRFDDetectionWorker()
          break
        case 'centerface':
          destroyCenterFaceDetectionWorker()
          break
        case 'mediapipe':
          destroyFaceDetectionWorker()
          break
      }
      this.currentWorker = null
      this.currentModel = null
    }
  }
  
  destroy() {
    this.cleanup()
  }
}

// 單例實例
let multiModelInstance: MultiModelDetection | null = null

export const getMultiModelDetection = (): MultiModelDetection => {
  if (!multiModelInstance) {
    multiModelInstance = new MultiModelDetection()
  }
  return multiModelInstance
}

export const destroyMultiModelDetection = () => {
  if (multiModelInstance) {
    multiModelInstance.destroy()
    multiModelInstance = null
  }
}

// 自動模型選擇 - 按優先級嘗試
export const autoSelectBestModel = async (backend: string = 'webgpu'): Promise<ModelType> => {
  const multiModel = getMultiModelDetection()
  
  // 按效果和穩定性排序的優先級 (暫時跳過 YOLO 因為 opset 相容性問題)
  const modelPriority: ModelType[] = ['scrfd', 'centerface', 'mediapipe'] // 'yolo' 暫時移除
  
  for (const modelType of modelPriority) {
    console.log(`Trying ${modelType} model...`)
    const success = await multiModel.switchModel(modelType, backend)
    if (success) {
      console.log(`Successfully selected ${modelType} as the detection model`)
      return modelType
    }
  }
  
  throw new Error('Failed to initialize any face detection model')
}