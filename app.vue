<template>
  <div>
    <video id="video" width="1920" height="1080" controls ref="videoEle" muted="muted"></video>
    <!-- <button @click="load"></button> -->
  </div>
  <canvas id='canvas'></canvas>
  <!-- <img src="/TEST.webp" id="testjpg"> -->
  <button @click="play" :disabled="!session">Play</button>
  <button @click="mute">mute</button>
  {{ output }}

</template>

<script lang="ts" setup>
import mpegts from 'mpegts.js'
import { Tensor } from 'onnxruntime-web';
import * as ort from 'onnxruntime-web/webgpu';
import { decode } from './utils/centerface_utils';
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
const output = ref()

const videoEle = ref<HTMLVideoElement>()
const videoContainer = document.createElement('video',)
const flvPlayer = ref()
const session = ref<ort.InferenceSession>()
const initFlv = () => {

  if (videoContainer != null && mpegts.isSupported()) {
    flvPlayer.value = mpegts.createPlayer({
      type: 'flv',
      isLive: true,
      hasAudio: true,
      url: "http://192.168.88.105:8081/live/test.flv?token=test"

    })

    flvPlayer.value.attachMediaElement(videoContainer)


    flvPlayer.value.load()
    // videoContainer.muted = true; // 静音



  }
}

const play = () => {
  flvPlayer.value.play()

}

let currentStream;
let currentProcessedStream;

const stopMediaTracks = stream => {
  stream.getTracks().forEach(track => {
    track.stop();
  });
};

videoContainer.addEventListener('playing', () => {
  // stopMediaTracks(currentProcessedStream);
  // stopMediaTracks(currentStream);

  console.log('play')
  const stream = videoContainer.captureStream();
  const videoTrack = stream.getVideoTracks()[0];
  // const audioTrack = stream.getAudioTracks()[0]
  window.stream = stream
  currentStream = stream

  const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack })
  const trackGenerator = new MediaStreamTrackGenerator({ kind: "video" });
  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);
  const processedStream = new MediaStream();
  processedStream.addTrack(trackGenerator);

  currentProcessedStream = processedStream;
  videoEle.value?.addEventListener("loadedmetadata", () => {
    videoEle.value?.play();
  });
  videoEle.value.srcObject = processedStream;

})

function shapeTransform(width: number, height: number): Array<number> {
  // Make spatial dims divisible by 32
  let wNew = Math.ceil(width / 32) * 32;
  let hNew = Math.ceil(height / 32) * 32;

  const scaleW = wNew / width;
  const scaleH = hNew / height;

  return [wNew, hNew, scaleW, scaleH];
}



const ImgResizer = (img: VideoFrame, width: number, height: number): ImageData => {
  const canvas = document.createElement('canvas')
  // set W-H
  // const { width, height } = img.codedRect as { width: number, height: number }
  //  calculate new w-h
  // const [wNew, hNew, scaleW, scaleH] = shapeTransform(width, height)

  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    return ctx.getImageData(0, 0, width, height)
  }
  else {
    throw new Error("canvas is empty");
  }
}

const canvas = new OffscreenCanvas(1920, 1080);
const ctx = canvas.getContext("2d");
const genFrame = async (bitmap, timestamp) => {
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const newBitmap = await createImageBitmap(canvas);
  return new VideoFrame(newBitmap, { timestamp });

}
function reshapeArray(data, dims) {
  const [B, C, H, W] = dims;
  let index = 0;
  const reshaped = [];

  for (let b = 0; b < B; b++) {
    const batch = [];
    for (let c = 0; c < C; c++) {
      const channel = [];
      for (let h = 0; h < H; h++) {
        const row = [];
        for (let w = 0; w < W; w++) {
          row.push(data[index]);
          index++;
        }
        channel.push(row);
      }
      batch.push(channel);
    }
    reshaped.push(batch);
  }

  return reshaped;
}
const transformer = new TransformStream({
  async transform(videoFrame: VideoFrame, controller) {
    const bitmap = await createImageBitmap(videoFrame);
    const timestamp = videoFrame.timestamp;

    const { width, height } = videoFrame.codedRect as { width: number, height: number }
    const [wNew, hNew, scaleW, scaleH] = shapeTransform(width, height)
    const resizeImg = ImgResizer(videoFrame, wNew, hNew)

    videoFrame.close();

    const processedInput = await Tensor.fromImage(resizeImg, {
      norm: {
        mean: 1, bias: 0
      }
    })


    const feeds = { "input.1": processedInput }

    const out = await session.value?.run(feeds)
    const { 537: heatmap, 538: scale, 539: offset, 540: lms } = out
    const rs_heatmap = reshapeArray(heatmap.data, heatmap.dims)
    const rs_scale = reshapeArray(scale.data, scale.dims)
    const rs_offset = reshapeArray(offset.data, offset.dims)
    const rs_lms = reshapeArray(lms.data, lms.dims)
    const size = [hNew, wNew]
    let [dets, lmss] = decode(rs_heatmap, rs_scale, rs_offset, rs_lms, size, 0.1)
    output.value = { dets, lmss }
    const newFrame = await genFrame(
      bitmap,
      timestamp,
    );
    // Predict
    // Blur Target
    // const newFrame;
    controller.enqueue(newFrame);

  },
  flush(controller) {
    controller.terminate();
  }

})

async function main() {
  // try {
  // create a new session and load the specific model.
  //
  // the model in this example contains a single MatMul node
  // it has 2 inputs: 'a'(float32, 3x4) and 'b'(float32, 4x3)
  // it has 1 output: 'c'(float32, 3x3)
  const model_options = {
    executionProviders: ['webgpu'] // 使用 WebGPU
  };
  const sess = await ort.InferenceSession.create('/centerface[3].onnx', model_options);
  session.value = sess


}

onMounted(() => {
  initFlv()
  main()

})
onUnmounted(() => {
  flvPlayer.value.unload()
  flvPlayer.value.detachMediaElement()
  flvPlayer.value.destroy()
})


</script>