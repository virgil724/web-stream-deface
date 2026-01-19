// Worker 管理器類別
export class FaceDetectionWorker {
  private worker: Worker | null = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null
  
  constructor() {
    this.createWorker()
  }
  
  private createWorker() {
    try {
      // 創建 Worker 實例
      this.worker = new Worker(
        new URL('./face-detection-worker.ts', import.meta.url),
        { type: 'module' }
      )
      
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)
      
    } catch (error) {
      console.error('Failed to create face detection worker:', error)
    }
  }
  
  private handleWorkerMessage(e: MessageEvent) {
    const { type } = e.data
    
    switch (type) {
      case 'worker-ready':
        console.log('Face detection worker is ready')
        break
        
      case 'initialized':
        this.isInitialized = e.data.success
        if (e.data.success) {
          console.log(`Face detector initialized with backend: ${e.data.backend}`)
        } else {
          console.error('Worker initialization failed:', e.data.error)
        }
        break
        
      case 'detection-result':
        // 這會由外部處理
        break
        
      case 'error':
        console.error('Worker error:', e.data.error)
        break
    }
  }
  
  private handleWorkerError(error: ErrorEvent) {
    console.error('Worker error event:', error)
  }
  
  // 初始化檢測器
  async initialize(backend: string = 'webgl'): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }
    
    this.initializationPromise = new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not created'))
        return
      }
      
      const handleInitMessage = (e: MessageEvent) => {
        if (e.data.type === 'initialized') {
          this.worker?.removeEventListener('message', handleInitMessage)
          if (e.data.success) {
            resolve()
          } else {
            reject(new Error(e.data.error))
          }
        }
      }
      
      this.worker.addEventListener('message', handleInitMessage)
      this.worker.postMessage({
        type: 'initialize',
        data: { backend }
      })
    })
    
    return this.initializationPromise
  }
  
  // 執行人臉檢測
  async detectFaces(imageData: ImageData): Promise<{
    detections: number[][]
    detectionTime: number
    faceCount: number
  }> {
    if (!this.worker || !this.isInitialized) {
      throw new Error('Worker not initialized')
    }
    
    return new Promise((resolve, reject) => {
      const handleDetectionMessage = (e: MessageEvent) => {
        if (e.data.type === 'detection-result') {
          this.worker?.removeEventListener('message', handleDetectionMessage)
          
          if (e.data.error) {
            reject(new Error(e.data.error))
          } else {
            resolve({
              detections: e.data.detections,
              detectionTime: e.data.detectionTime,
              faceCount: e.data.faceCount
            })
          }
        }
      }
      
      this.worker.addEventListener('message', handleDetectionMessage)
      this.worker.postMessage({
        type: 'detect',
        data: { imageData }
      })
    })
  }
  
  // 檢查是否已初始化
  get initialized(): boolean {
    return this.isInitialized
  }
  
  // 銷毀 Worker
  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.isInitialized = false
      this.initializationPromise = null
    }
  }
}

// 單例實例
let workerInstance: FaceDetectionWorker | null = null

export const getFaceDetectionWorker = (): FaceDetectionWorker => {
  if (!workerInstance) {
    workerInstance = new FaceDetectionWorker()
  }
  return workerInstance
}

export const destroyFaceDetectionWorker = () => {
  if (workerInstance) {
    workerInstance.destroy()
    workerInstance = null
  }
}