<template>
  <div class="base">
    <video ref="video_ref" controls></video>
    <BlurVideo class="float" :style="{ 'opacity': `${opacity[0]}%` }" :stream="stream" v-if="showBlur && stream">
    </BlurVideo>
    <div class="switch flex flex-row gap-4">
      <div class="flex items-center space-x-2">
        <Switch id="blur" v-model:checked="showBlur" />
        <Label for="blur">blur</Label>
      </div>
      <div class="flex flex-row items-center space-x-2 ">
        <Slider id="slider" v-model="opacity" :max="100" :step="1" class="w-[100px]" />
        <Label for="slider" class="w-[100px]">不透明度 : {{ opacity[0] }}</Label>
      </div>

      <Button variant="outline" size="icon" class="h-8" @click="back">
        <Undo2 class="h-4 " />
      </Button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Undo2 } from 'lucide-vue-next';

import mpegts from 'mpegts.js';
const opacity = ref([100])
const video_ref = ref<HTMLVideoElement | undefined>()
const flvPlayer = ref<mpegts.Player>()
const showBlur = ref(false)

const stream = ref()
if (video_ref.value) {
  stream.value = video_ref.value.captureStream()
}
// Create a union type of all video types
// Define the type for the component props
interface Props {
  video: Video;
  back: Function
}

const { video, back } = defineProps<Props>()

let retryCount = 0;
const maxDelay = 30000; // 最大延遲時間(毫秒)

const loadStream = (url?: string, streamType?: StreamType) => {
  if (video_ref.value != null && mpegts.isSupported()) {
    flvPlayer.value = mpegts.createPlayer({
      type: streamType || 'flv',
      isLive: true,
      hasAudio: true,
      // url: "/206779_small.mp4"
      url: url || "http://192.168.88.105:8081/live/test.flv?token=test"
    })

    flvPlayer.value.on(mpegts.Events.LOADING_COMPLETE, (e) => {
      console.log('加載被中斷');
      retryCount++;

      const delay = Math.max(5000, Math.min(1000 * Math.pow(2, retryCount), maxDelay));

      console.log(`將在 ${delay / 1000} 秒後重試 (第 ${retryCount} 次)`);
      setTimeout(() => {
        console.log('嘗試重新加載');
        loadVideo() // 假設這是重新加載的方法
        // LUL 這是有問題的阿XDD

        // 重新加載過 只要撥放 => +上blur
        if (showBlur.value == true) {
          showBlur.value = false
          video_ref.value.addEventListener('playing', () => {
            setTimeout(() => {
              showBlur.value = true
              retryCount = 0
            }, 250)

          })

        }

      }, delay);
    });

    flvPlayer.value.attachMediaElement(video_ref.value)
    flvPlayer.value.load()
    flvPlayer.value.play()
  }

}

const loadFile = (file: File) => {
  const url = URL.createObjectURL(file);
  if (video_ref.value) {
    video_ref.value.src = url;
    // We need to revoke the URL when the component is unmounted
    onUnmounted(() => URL.revokeObjectURL(url));
  }
};


const loadCapture = (stream: MediaStream) => {
  if (video_ref.value) {
    video_ref.value.srcObject = stream;
  }
};


const clearVideo = () => {
  if (video_ref.value) {
    video_ref.value.pause();
    video_ref.value.src = '';
    video_ref.value.srcObject = null;
  }
};

const loadVideo = () => {
  clearVideo();
  switch (video.type) {
    case VideoType.Stream:
      loadStream(video.content, video.streamType);
      break;
    case VideoType.File:
      loadFile(video.content);
      break;
    case VideoType.Capture:
      loadCapture(video.content);
      break;
  }
};


watch(() => video, loadVideo, { deep: true });

onMounted(loadVideo);
onMounted(() => {
  if (video_ref.value) {
    stream.value = video_ref.value.captureStream()
  }
})
onUnmounted(clearVideo);
</script>

<style>
.base {
  position: relative;
  width: 100%;
  height: 100%;
}

.float {
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 1;
  /* opacity: 50%; */
}


.switch {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 100px;
  height: 34px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.base:hover .switch {
  opacity: 1;
  z-index: 2;
}

video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: aqua;
}
</style>