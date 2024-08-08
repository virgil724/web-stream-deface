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

export const drawBlur = async (bitmap: ImageBitmap): Promise<ImageBitmap> => {
  const { height, width } = bitmap
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.filter = 'blur(20px)'
  ctx?.drawImage(bitmap, 0, 0, width, height)
  return createImageBitmap(canvas)

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
