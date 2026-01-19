import webglFilter from '@longlost/webgl-filter/webgl-filter.js';

export const blurCanvas = (canvas: OffscreenCanvas) => {
  const filter = webglFilter();
  filter.addFilter('blur', 10);
  filter.addFilter('blur', 10);
  filter.addFilter('blur', 10);
  const filteredImage = filter.apply(canvas);
  return filteredImage
}
export const copyCanvas = (corpBound, orig_cav) => {
  const { x, y, width, height } = corpBound
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.filter = "blur(16px)"


  ctx?.drawImage(orig_cav, x, y, width, height, 0, 0, width, height)
  return canvas
}

class CanvasPool {
  private pool: Map<string, OffscreenCanvas[]> = new Map()
  private maxPoolSize = 5

  getCanvas(width: number, height: number): OffscreenCanvas {
    const key = `${width}x${height}`
    const canvases = this.pool.get(key) || []
    
    if (canvases.length > 0) {
      return canvases.pop()!
    }
    
    return new OffscreenCanvas(width, height)
  }

  returnCanvas(canvas: OffscreenCanvas, width: number, height: number): void {
    const key = `${width}x${height}`
    const canvases = this.pool.get(key) || []
    
    if (canvases.length < this.maxPoolSize) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, width, height)
      canvases.push(canvas)
      this.pool.set(key, canvases)
    }
  }
}

const canvasPool = new CanvasPool()

export const drawBlur = async (bitmap: ImageBitmap): Promise<ImageBitmap> => {
  const { height, width } = bitmap
  const canvas = canvasPool.getCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.filter = 'blur(20px)'
  ctx?.drawImage(bitmap, 0, 0, width, height)
  
  const result = await createImageBitmap(canvas)
  canvasPool.returnCanvas(canvas, width, height)
  return result
}

export const drawBlurBatch = async (bitmaps: ImageBitmap[]): Promise<ImageBitmap[]> => {
  if (bitmaps.length === 0) return []
  
  const results = await Promise.all(bitmaps.map(async (bitmap) => {
    const { height, width } = bitmap
    const canvas = canvasPool.getCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.filter = 'blur(20px)'
    ctx?.drawImage(bitmap, 0, 0, width, height)
    
    const result = await createImageBitmap(canvas)
    canvasPool.returnCanvas(canvas, width, height)
    return result
  }))
  
  return results
}
export const applyCanvas = (ctx: OffscreenCanvasRenderingContext2D, blurCav: OffscreenCanvas, corpBound) => {
  const { x, y, width, height } = corpBound
  ctx.drawImage(blurCav, x, y, width, height)

}

export const roundBounds = (bounds) =>
  Object.keys(bounds).reduce((copy, property) => {
    copy[property] = Math.round(bounds[property]);
    return copy;
  }, {});


export function shapeTransform(width: number, height: number): Array<number> {
  // Use fixed input size for model compatibility
  const wNew = 320;
  const hNew = 320;

  const scaleW = wNew / width;
  const scaleH = hNew / height;

  return [wNew, hNew, scaleW, scaleH];
}


export const ImgResizer = (img: ImageBitmap, width: number, height: number): ImageData => {
  // set W-H
  // const { width, height } = img.codedRect as { width: number, height: number }
  //  calculate new w-h
  // const [wNew, hNew, scaleW, scaleH] = shapeTransform(width, height)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)
  if (ctx !== null) {
    return ctx.getImageData(0, 0, width, height)
  }
  else {
    throw new Error("canvas is empty");
  }
}
