<style>
.float {
  position: absolute;
  top: 0px;
  left: 0px;
  width: 1920px;
  height: 1080px;
  /* background-color: aqua; */
  z-index: 1;
  /* opacity: 50%; */
}

.parent-container {
  position: relative;
}
</style>
<template>
  <div class="parent-container">
    <video id="video" width="1920" height="1080" controls ref="videoEle" muted></video>
    <!-- <canvas class="float" id="top"></canvas> -->
    <video id="top" class="float" controls muted></video>
    <!-- <button @click="load"></button> -->
  </div>
  <canvas id='canvas'> </canvas>
  <!-- <img src="/TEST.webp" id="testjpg"> -->
  <button @click="play" :disabled="!session">Play</button>
  <button @click="mute">mute</button>
  <button @click="pause">pause</button>
  <!-- {{ output }} -->
  {{ out_process }}

</template>

<script lang="ts" setup>
import mpegts from 'mpegts.js';
import * as ort from 'onnxruntime-web/webgpu';
import { decode } from './utils/centerface_utils';

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
ort.env.webgpu.powerPreference = 'high-performance'

const output = ref({ dets: [], lmss: [] })
const out_process = computed(
  () => (output.value['dets'].length)
)

const videoEle = ref<HTMLVideoElement>()
const flvPlayer = ref()
const session = ref<ort.InferenceSession>()
const initFlv = () => {

  if (videoEle.value != null && mpegts.isSupported()) {
    flvPlayer.value = mpegts.createPlayer({
      type: 'flv',
      // isLive: true,
      // hasAudio: false,
      // url: "/206779_small.mp4"
      url: "http://192.168.88.105:8081/live/test.flv?token=test"

    })

    flvPlayer.value.attachMediaElement(videoEle.value)

    // document.getElementById('teest')?.appendChild(videoContainer)
    flvPlayer.value.load()
    // videoContainer.muted = true; // 静音
  };



}


const play = () => {
  flvPlayer.value.play()

}

const pause = () => {
  flvPlayer.value.pause()

}

const mute = () => {
  videoContainer.muted = !videoContainer.muted
}

let currentStream;
let currentProcessedStream;

const stopMediaTracks = stream => {
  stream.getTracks().forEach(track => {
    track.stop();
  });
};

function shapeTransform(width: number, height: number): Array<number> {
  // Make spatial dims divisible by 32
  let wNew = Math.ceil(width / 32) * 16;
  let hNew = Math.ceil(height / 32) * 16;

  const scaleW = wNew / width;
  const scaleH = hNew / height;

  return [wNew, hNew, scaleW, scaleH];
}

const canvas = new OffscreenCanvas(1920, 1080);
const ctx = canvas.getContext("2d");
const ImgResizer = (img: VideoFrame, width: number, height: number): ImageData => {
  // set W-H
  // const { width, height } = img.codedRect as { width: number, height: number }
  //  calculate new w-h
  // const [wNew, hNew, scaleW, scaleH] = shapeTransform(width, height)

  ctx.drawImage(img, 0, 0, width, height)
  if (ctx !== null) {
    return ctx.getImageData(0, 0, width, height)
  }
  else {
    throw new Error("canvas is empty");
  }
}


const genFrame = async (dets, bitmap, timestamp) => {
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
    // Predict
    const processedInput = bufferToTensor(resizeImg.data, {
      width: wNew, height: hNew,
      norm: {
        mean: 1, bias: 0
      },
    })
    // const processedInput = await Tensor.fromImage(resizeImg, {

    //   norm: {
    //     mean: 1, bias: 0
    //   },
    // })
    const feeds = { "input.1": processedInput }
    const out = await session.value?.run(feeds)
    // processedInput.dispose()

    const { 537: heatmap, 538: scale, 539: offset, 540: lms } = out
    const rs_heatmap = reshapeArray(heatmap.data, heatmap.dims)
    const rs_scale = reshapeArray(scale.data, scale.dims)
    const rs_offset = reshapeArray(offset.data, offset.dims)
    const rs_lms = reshapeArray(lms.data, lms.dims)
    const size = [hNew, wNew]
    let [dets, lmss] = decode(rs_heatmap, rs_scale, rs_offset, rs_lms, size, 0.2)
    output.value = { dets, lmss }
    // Blur Target

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

async function main() {
  const model_options = {
    executionProviders: ['webgpu'],// 使用 WebGPU,
    excutionMode: 'parallel'
  };
  const sess = await ort.InferenceSession.create('/centerface[3].onnx', model_options);
  session.value = sess
}

onMounted(() => {
  initFlv()
  main()
  videoEle.value.addEventListener('playing', () => {
    const videoContainer = document.getElementById('top',)
    videoContainer.muted = true

    // stopMediaTracks(currentProcessedStream);
    // stopMediaTracks(currentStream);

    console.log('play')
    const stream = videoEle.value.captureStream();
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
    videoContainer?.addEventListener("loadedmetadata", () => {
      videoContainer?.play();
    });
    videoContainer.srcObject = processedStream;

  })



})
onUnmounted(() => {
  flvPlayer.value.unload()
  flvPlayer.value.detachMediaElement()
  flvPlayer.value.destroy()
})


</script>