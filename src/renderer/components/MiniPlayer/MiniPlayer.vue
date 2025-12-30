<template>
  <Transition name="slide-up">
    <div
      v-if="currentTrack && isMusicMode"
      class="mini-player"
      @click="expandPlayer"
    >
      <!-- Progress Bar (top) -->
      <div class="mini-progress">
        <div
          class="mini-progress-fill"
          :style="{ width: progressPercent + '%' }"
        />
      </div>

      <!-- Content -->
      <div class="mini-content">
        <img
          :src="thumbnailUrl"
          :alt="currentTrack.title"
          class="mini-thumb"
        >

        <div class="mini-info">
          <span class="mini-title">{{ currentTrack.title }}</span>
          <span class="mini-artist">{{ currentTrack.author }}</span>
        </div>

        <div class="mini-controls" @click.stop>
          <button class="mini-btn" @click="playPrevious">
            <FontAwesomeIcon :icon="['fas', 'step-backward']" />
          </button>
          <button class="mini-btn play-btn" @click="togglePlay">
            <FontAwesomeIcon :icon="isPlaying ? ['fas', 'pause'] : ['fas', 'play']" />
          </button>
          <button class="mini-btn" @click="playNext">
            <FontAwesomeIcon :icon="['fas', 'step-forward']" />
          </button>
          <button class="mini-btn close-btn" @click="closeMiniPlayer">
            <FontAwesomeIcon :icon="['fas', 'times']" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import store from '../../store/index'

const router = useRouter()
const route = useRoute()

// Store getters
const currentTrack = computed(() => store.getters.getCurrentTrack)
const isPlaying = computed(() => store.getters.getIsPlaying)
const isMusicMode = computed(() => store.getters.getIsMusicMode)
const currentTime = computed(() => store.getters.getCurrentTime)
const duration = computed(() => store.getters.getDuration)

// Hide mini player on music player page
const showMiniPlayer = computed(() => {
  return currentTrack.value &&
         isMusicMode.value &&
         !route.path.startsWith('/music/play')
})

const thumbnailUrl = computed(() => {
  if (!currentTrack.value) return ''
  return `https://i.ytimg.com/vi/${currentTrack.value.videoId}/mqdefault.jpg`
})

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return (currentTime.value / duration.value) * 100
})

function expandPlayer() {
  if (currentTrack.value) {
    router.push(`/music/play/${currentTrack.value.videoId}`)
  }
}

function togglePlay() {
  // 透過 global audio element 或 event bus 控制播放
  store.dispatch('setPlaying', !isPlaying.value)
}

function playPrevious() {
  store.dispatch('playPrevious')
}

function playNext() {
  store.dispatch('playNext')
}

function closeMiniPlayer() {
  store.dispatch('clearQueue')
}
</script>

<style scoped>
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #282828;
  z-index: 1000;
  cursor: pointer;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
}

/* Progress bar */
.mini-progress {
  height: 2px;
  background: #404040;
}

.mini-progress-fill {
  height: 100%;
  background: #ff0000;
  transition: width 0.2s linear;
}

/* Content */
.mini-content {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 12px;
}

.mini-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
}

.mini-info {
  flex: 1;
  min-width: 0;
}

.mini-title,
.mini-artist {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-title {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}

.mini-artist {
  font-size: 12px;
  color: #aaa;
}

/* Controls */
.mini-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  padding: 8px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.mini-btn:hover {
  opacity: 1;
}

.mini-btn.play-btn {
  font-size: 22px;
  background: #fff;
  color: #000;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
}

.mini-btn.play-btn:hover {
  background: #f0f0f0;
}

.mini-btn.play-btn svg {
  color: #000;
}

.mini-btn.close-btn {
  color: #aaa;
  font-size: 16px;
}

.mini-btn.close-btn:hover {
  color: #ff0000;
}

/* Slide up animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .mini-content {
    padding: 6px 10px;
  }

  .mini-thumb {
    width: 40px;
    height: 40px;
  }

  .mini-btn {
    padding: 6px;
    font-size: 16px;
  }
}

/* Desktop view - full width */
@media (min-width: 769px) {
  .mini-player {
    left: 0;
    width: 100%;
  }
}
</style>
