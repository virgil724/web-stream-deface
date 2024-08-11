<template>
  <video ref="videoRef"></video>
</template>

<script lang="ts" setup>
import type { InferenceSession } from 'onnxruntime-web';
const { backend } = inject(backend_provide) as BackendContext
const videoRef = ref()
const sess = ref<InferenceSession | null>()
const props = defineProps<{
  stream: MediaStream
}>()
const canvas = new OffscreenCanvas(0, 0);
const ctx = canvas.getContext("2d");

const genFrame = async (dets, bitmap, timestamp) => {
  ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const All_crop = dets.map((element) => roundBounds({
    x: element[0] * 2,
    y: element[1] * 2,
    width: (element[2] - element[0]) * 2,
    height: (element[3] - element[1]) * 2
  }));
  const small_crop = All_crop.filter(crop => crop.width < 90 || crop.height < 90)
  small_crop.forEach(element => {
    ctx.fillStyle = 'rgba(200,0,0,1)'
    const { x, y, width, height } = element
    ctx?.fillRect(x, y, width, height)

  });

  const corp_arr = All_crop.filter(crop => crop.width >= 90 && crop.height >= 90)

  const bitmapPromises = corp_arr.map(crop => {
    const { x, y, width, height } = crop;
    return createImageBitmap(canvas, x, y, width, height);
  });
  const faces = await Promise.all(bitmapPromises);

  const drawBlurPromises = faces.map((face) => {
    return drawBlur(face)
  })
  const blurFaces = await Promise.all(drawBlurPromises)
  for (let index = 0; index < blurFaces.length; index++) {
    const element = blurFaces[index];
    const { x, y, width, height } = corp_arr[index];
    ctx?.drawImage(element, 0, 0, width, height, x, y, width, height)
  }

  //   ctx.fillRect(~~element[0] * 2, ~~element[1] * 2, ~~((element[2] - element[0]) * 2), ~~((element[3] - element[1]) * 2));

  const newBitmap = await createImageBitmap(canvas);
  return new VideoFrame(newBitmap, { timestamp });

}
const transformer = new TransformStream({
  async transform(videoFrame: VideoFrame, controller) {

    const bitmap = await createImageBitmap(videoFrame)
    const timestamp = videoFrame.timestamp

    const { width, height } = videoFrame.codedRect as { width: number, height: number }
    const [wNew, hNew, scaleW, scaleH] = shapeTransform(width, height)
    const resizeBitMap = await createImageBitmap(videoFrame)
    const resizeImg = ImgResizer(resizeBitMap, wNew, hNew)
    videoFrame.close();
    const processedInput = bufferToTensor(resizeImg.data, {
      width: wNew, height: hNew,
      norm: {
        mean: 1, bias: 0
      },
    })
    const feeds = { "input.1": processedInput }
    const out = await sess?.value?.run(feeds)
    const { 537: heatmap, 538: scale, 539: offset, 540: lms } = out
    const rs_heatmap = reshapeArray(heatmap.data, heatmap.dims)
    const rs_scale = reshapeArray(scale.data, scale.dims)
    const rs_offset = reshapeArray(offset.data, offset.dims)
    const rs_lms = reshapeArray(lms.data, lms.dims)
    const size = [hNew, wNew]
    let [dets, lmss] = decode(rs_heatmap, rs_scale, rs_offset, rs_lms, size, 0.2)

    canvas.width = width
    canvas.height = height


    const newFrame = await genFrame(
      dets,
      bitmap,
      timestamp,

    );
    controller.enqueue(newFrame);

  },
  flush(controller) {
    controller.terminate();
  }


})

const processStream = () => {
  const videoTrack = props.stream.getVideoTracks()[0]

  const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack })
  const trackGenerator = new MediaStreamTrackGenerator({ kind: "video" })
  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);

  const processedStream = new MediaStream();
  processedStream.addTrack(trackGenerator);

  videoRef.value.addEventListener("loadedmetadata", () => {
    videoRef.value?.play();
  });
  videoRef.value.srcObject = processedStream;
}

onMounted(async () => {

  sess.value = await createSession(backend.value)
  processStream()
})

onUnmounted(() => {
  sess.value?.release()
})


</script>

<style></style>