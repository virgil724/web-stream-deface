# 網路串流人臉遮蔽專案 - 開發進度

## 專案概述
一個基於 Nuxt 3 的即時網路串流人臉檢測與遮蔽系統。

## 當前狀態

### ✅ 已完成功能
1. **多後端支援**
   - WebGL GPU 加速 (優先)
   - CPU 降級備援
   - 自動降級機制

2. **多模型人臉檢測系統** (最新升級)
   - 支援模型：YOLOv8n/v10n/v11n-Face、SCRFD 2.5G、CenterFace、MediaPipe Full
   - 自動模型選擇：按效果優先級自動選擇最佳模型
   - 檢測方式：每幀即時檢測（最高精度模式）
   - 分辨率：全解析度檢測

3. **視覺效果**
   - 所有檢測到的人臉顯示紅色框框
   - 半透明填充 + 實心邊框
   - 動態追蹤顯示

4. **視頻處理**
   - 支援攝像頭即時串流
   - 支援文件上傳
   - 支援網路串流URL
   - 視頻播放器自動適應視窗大小（最大80%視窗）

5. **性能監控**
   - 每5秒輸出檢測統計
   - 監控項目：檢測人臉數、平均檢測時間、檢測FPS、視頻解析度

### ✅ 性能優化完成
1. **智能檢測策略**
   - 自適應檢測頻率：有人臉時每5幀，無人臉時每15幀
   - 動態分辨率縮放：根據視頻大小自動調整檢測解析度
   - 模型優化：切換至 'short' 模型提升速度

2. **Web Worker 架構** (最新)
   - 人臉檢測在獨立 Worker 線程中執行
   - 主線程不被檢測計算阻塞
   - 參考 WebSight 專案的 Worker 模式設計
   - 支援 WebGL/CPU 後端自動降級

3. **智慧多模型檢測模式** (最新)
   - 移除檢測頻率限制，每幀都檢測
   - 自動選擇最佳可用模型（YOLO → SCRFD → CenterFace → MediaPipe）
   - 支援多種後端：ONNX Runtime、TensorFlow.js
   - Worker 確保主線程仍然流暢

### 🎯 檢測效果
- ✅ **檢測精確度**：YOLO 系列優先，業界頂級檢測效果
- ✅ **多人檢測**：根據模型支援最多8-10人檢測
- ✅ **小人臉檢測**：YOLO/SCRFD 優先，小人臉檢測大幅提升
- ✅ **檢測速度**：即時檢測，人臉出現立即回應
- ✅ **自動降級**：4層降級保護，確保穩定運行

## 技術架構

### 前端框架
- **Nuxt 3** - Vue.js 全端框架
- **TypeScript** - 類型安全
- **TailwindCSS** - 樣式系統

### 人臉檢測
- **ONNX Runtime** - 高性能推理引擎 (YOLO, SCRFD, CenterFace)
- **TensorFlow.js** - 機器學習框架 (MediaPipe)
- **多模型支援** - YOLOv8n/v10n/v11n-Face, SCRFD, CenterFace, MediaPipe
- **WebGL/WASM/CPU** - 多後端硬體加速支援

### 視頻處理
- **MediaStream API** - 攝像頭存取
- **VideoFrame API** - 視頻幀處理
- **OffscreenCanvas** - 離線畫布處理

## 檔案結構
```
├── components/
│   └── BlurVideo.vue          # 主要視頻處理組件
├── pages/
│   ├── index.vue              # 後端選擇頁面
│   └── predict.vue            # 視頻處理頁面
├── utils/
│   ├── multi-model-detection.ts    # 多模型智慧選擇器 (當前使用)
│   ├── yolo-detection-worker.ts    # YOLO Worker 檢測實現 (優先)
│   ├── yolo-worker-manager.ts      # YOLO Worker 管理器 (優先)
│   ├── scrfd-detection-worker.ts   # SCRFD Worker 檢測實現
│   ├── scrfd-worker-manager.ts     # SCRFD Worker 管理器
│   ├── centerface-detection-worker.ts # CenterFace Worker 實現
│   ├── centerface-worker-manager.ts   # CenterFace Worker 管理器
│   ├── face-detection-worker.ts    # TF.js Worker 實現（備用）
│   ├── worker-face-detection.ts    # TF.js Worker 管理器（備用）
│   ├── tfjs_face_detection.ts      # TensorFlow.js 人臉檢測（備用）
│   ├── scrfd_face_detection.ts     # SCRFD 原始實現
│   ├── yolo_face_detection.ts      # YOLO 原始實現
│   ├── onnx_utils.ts              # ONNX 工具（已棄用）
│   └── image_utils.ts             # 圖像處理工具
└── public/
    ├── yolov11n-face.onnx     # YOLOv11n 人臉檢測模型 (最新)
    ├── yolov10n-face.onnx     # YOLOv10n 人臉檢測模型
    ├── yolov8n-face.onnx      # YOLOv8n 人臉檢測模型
    ├── scrfd_2.5g.onnx        # SCRFD 2.5G 模型
    ├── centerface.onnx        # CenterFace 模型
    └── centerface_mod2.onnx   # CenterFace 修改版模型
```

## 性能數據
- **檢測精度**：頂級（YOLO 系列優先 + 全解析度）
- **檢測範圍**：最多8-10人同時檢測  
- **當前模式**：Web Worker + 多模型智慧選擇 + 即時檢測
- **性能表現**：即時回應，主線程完全流暢

## 下一步開發計劃
1. **功能升級**：將紅框改為實際的模糊或遮蔽效果
2. **進階優化**：考慮實現更複雜的追蹤算法
3. **用戶體驗**：添加檢測模式切換選項

## 開發者備註
- 性能優化已完成，檢測與流暢度達到平衡
- Web Worker 架構確保主線程流暢運行
- 參考 WebSight 專案成功實現 Worker 模式
- 所有必要的備用模型框架已準備完成

---
*最後更新：2025-08-17*
*開發狀態：檢測功能完成，Worker 架構完成*