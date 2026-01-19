<template>
  <div ref="baseRef" class="base group">
    <video ref="video_ref" controls class="video-element" :style="cropStyle"></video>
    <BlurVideo class="float" :style="{ 'opacity': `${opacity[0]}%`, ...cropStyle }" :stream="stream"
      :mask-type="maskType" v-if="showBlur && stream">
    </BlurVideo>

    <!-- Safe Zone Overlay -->
    <div v-if="showSafeZone" class="safe-zone-overlay" :style="safeZoneStyle">
      <div class="safe-zone-border"></div>
      <div class="safe-zone-label">安全區</div>
    </div>

    <!-- Control Panel -->
    <div class="control-panel">
      <div class="flex items-center gap-4 flex-wrap">
        <!-- Blur Toggle -->
        <div class="flex items-center gap-2">
          <Switch id="blur" v-model:checked="showBlur" />
          <Label for="blur" class="text-sm font-medium cursor-pointer">遮蔽</Label>
        </div>

        <!-- Mask Type Selector -->
        <div v-if="showBlur" class="flex items-center gap-2">
          <Label class="text-sm text-muted-foreground">效果</Label>
          <Select v-model="maskType">
            <SelectTrigger class="w-28 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in maskOptions" :key="opt.type" :value="opt.type">
                <span class="flex items-center gap-2">
                  <span>{{ opt.icon }}</span>
                  <span>{{ opt.label }}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Opacity Slider -->
        <div class="flex items-center gap-3">
          <Label for="slider" class="text-sm text-muted-foreground whitespace-nowrap">
            不透明度
          </Label>
          <Slider id="slider" v-model="opacity" :max="100" :step="1" class="w-24" />
          <span class="text-sm font-mono text-muted-foreground w-8">{{ opacity[0] }}%</span>
        </div>

        <!-- Separator -->
        <div class="h-6 w-px bg-border hidden sm:block"></div>

        <!-- Safe Zone Toggle -->
        <div class="flex items-center gap-2">
          <Switch id="safezone" v-model:checked="showSafeZone" />
          <Label for="safezone" class="text-sm font-medium cursor-pointer">安全區</Label>
        </div>

        <!-- Crop Margin Slider -->
        <div class="flex items-center gap-3">
          <Label class="text-sm text-muted-foreground whitespace-nowrap">裁切</Label>
          <Slider v-model="cropMargin" :max="20" :step="1" class="w-20" />
          <span class="text-sm font-mono text-muted-foreground w-8">{{ cropMargin[0] }}%</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <!-- Fullscreen Button -->
        <Button variant="outline" size="sm" @click="toggleFullscreen" class="gap-2">
          <Maximize2 v-if="!isFullscreen" class="h-4 w-4" />
          <Minimize2 v-else class="h-4 w-4" />
          <span class="hidden sm:inline">{{ isFullscreen ? '退出' : '全螢幕' }}</span>
        </Button>

        <!-- Back Button -->
        <Button variant="outline" size="sm" @click="back" class="gap-2">
          <Undo2 class="h-4 w-4" />
          <span class="hidden sm:inline">返回</span>
        </Button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Undo2, Maximize2, Minimize2 } from 'lucide-vue-next';
import { maskOptions, defaultMaskType, type MaskType } from '~/utils/mask-types';

import mpegts from 'mpegts.js';
const opacity = ref([100])
const video_ref = ref<HTMLVideoElement | undefined>()
const flvPlayer = ref<mpegts.Player>()
const showBlur = ref(false)
const maskType = ref<MaskType>(defaultMaskType)
const isFullscreen = ref(false)

const baseRef = ref<HTMLDivElement>()

const toggleFullscreen = async () => {
  if (!baseRef.value) return

  if (!document.fullscreenElement) {
    await baseRef.value.requestFullscreen()
    isFullscreen.value = true
  } else {
    await document.exitFullscreen()
    isFullscreen.value = false
  }
}

// Listen for fullscreen change events
onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

const stream = ref()
if (video_ref.value) {
  stream.value = video_ref.value.captureStream()
}

interface Props {
  video: Video;
  back: Function
}

const { video, back } = defineProps<Props>()

let retryCount = 0;
const maxDelay = 30000;

const loadStream = (url?: string, streamType?: StreamType) => {
  if (video_ref.value != null && mpegts.isSupported()) {
    flvPlayer.value = mpegts.createPlayer({
      type: streamType || 'flv',
      isLive: true,
      hasAudio: true,
      url: url || "http://192.168.88.105:8081/live/test.flv?token=test"
    })

    flvPlayer.value.on(mpegts.Events.LOADING_COMPLETE, (e) => {
      console.log('加載被中斷');
      retryCount++;

      const delay = Math.max(5000, Math.min(1000 * Math.pow(2, retryCount), maxDelay));

      console.log(`將在 ${delay / 1000} 秒後重試 (第 ${retryCount} 次)`);
      setTimeout(() => {
        console.log('嘗試重新加載');
        loadVideo()

        if (showBlur.value == true) {
          showBlur.value = false
          video_ref.value?.addEventListener('playing', () => {
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

<style scoped>
.base {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  overflow: hidden;
}

.video-element {
  width: 100%;
  height: 100%;
  max-height: 70vh;
  object-fit: contain;
  background-color: hsl(var(--card));
  border-radius: 1rem;
}

.float {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}

.control-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: hsl(var(--card) / 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  opacity: 0;
  transform: translateY(-100%);
  transition: all 0.3s ease;
}

.group:hover .control-panel {
  opacity: 1;
  transform: translateY(0);
}
</style>