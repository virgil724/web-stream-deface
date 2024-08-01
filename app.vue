<template>
  <div>
    <video id="video" width="1920" height="1080" controls ref="videoEle" muted="muted"></video>
    <!-- <button @click="load"></button> -->
  </div>
  <canvas id='canvas'></canvas>
  <!-- <img src="/TEST.webp" id="testjpg"> -->
  <button @click="play">Play</button>
  <button @click="mute">mute</button>

</template>

<script lang="ts" setup>
import ndarray from "ndarray";
import ops from "ndarray-ops";

import mpegts from 'mpegts.js'
import { Tensor } from 'onnxruntime-web';
import * as ort from 'onnxruntime-web';
const videoEle = ref<HTMLVideoElement>()

// import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.min.js";
// // set wasm path override
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
const videoContainer = document.createElement('video',)
const flvPlayer = ref()
const initFlv = () => {

  if (videoContainer != null && mpegts.isSupported()) {
    flvPlayer.value = mpegts.createPlayer({
      type: 'flv',
      isLive: true,
      hasAudio: true,
      url: "http://192.168.88.105:8081/live/test.flv?token=test"

    })

    flvPlayer.value.attachMediaElement(videoContainer)


    // document.body.appendChild(videoContainer);




    flvPlayer.value.load()
    // audioTrack = videoContainer.captureStream().getAudioTracks()[0]
    // console.log(audioTrack)
    // videoContainer.muted = true; // 静音



    // const trackProcessor = new MediaStreamTrackProcessor(videoTrack);
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

const ensureRGB = (imageData: ImageData) => {
  let width;
  let height;


  const dataTensor = ndarray(new Float32Array(data), [width, height, 4]);
  const dataProcessedTensor = ndarray(new Float32Array(width * height * 3), [
    1,
    3,
    width,
    height,
  ]);

  ops.assign(
    dataProcessedTensor.pick(0, 0, null, null),
    dataTensor.pick(null, null, 0)
  );
  ops.assign(
    dataProcessedTensor.pick(0, 1, null, null),
    dataTensor.pick(null, null, 1)
  );
  ops.assign(
    dataProcessedTensor.pick(0, 2, null, null),
    dataTensor.pick(null, null, 2)
  );
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
  const session = await ort.InferenceSession.create('/centerface.onnx',);

  // const htmlTensor = await ort.Tensor.fromImage(, {
  //   norm: {
  //     mean: 1, bias: 0
  //   }
  // },);









  //   // prepare inputs. a tensor need its corresponding TypedArray as data
  //   const dataA = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  //   const dataB = Float32Array.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  //   const tensorA = new ort.Tensor('float32', dataA, [3, 4]);
  //   const tensorB = new ort.Tensor('float32', dataB, [4, 3]);

  //   // prepare feeds. use model input names as keys.
  //   const feeds = { a: tensorA, b: tensorB };

  //   // feed inputs and run
  // const results = await session.run(feeds);

  //   // read from results
  //   const dataC = results.c.data;
  //   document.write(`data of result tensor 'c': ${dataC}`);

  // } catch (e) {
  //   document.write(`failed to inference ONNX model: ${e}.`);
  // }
}

onMounted(() => {
  initFlv()
  // main()

})
onUnmounted(() => {
  flvPlayer.value.unload()
  flvPlayer.value.detachMediaElement()
  flvPlayer.value.destroy()
})


</script>