<template>
  <div class="music-player" :class="{ 'has-queue': showQueue }">
    <!-- Header -->
    <div class="music-player-header">
      <button class="header-btn back-btn" @click="goBack">
        <FontAwesomeIcon :icon="['fas', 'chevron-down']" />
      </button>
      <MusicModeToggle />
      <div class="header-actions">
        <button class="header-btn" @click="shareTrack">
          <FontAwesomeIcon :icon="['fas', 'share']" />
        </button>
        <button class="header-btn" @click="toggleMenu">
          <FontAwesomeIcon :icon="['fas', 'ellipsis-v']" />
        </button>
      </div>
    </div>

    <!-- Album Art -->
    <div class="album-art-container">
      <img
        v-if="currentTrack"
        :src="thumbnailUrl"
        :alt="currentTrack.title"
        class="album-art"
        :class="{ playing: isPlaying }"
      >
      <div v-else class="album-art-placeholder">
        <FontAwesomeIcon :icon="['fas', 'music']" />
      </div>
    </div>

    <!-- Track Info -->
    <div class="track-info">
      <h2 class="track-title">{{ currentTrack?.title || 'No track selected' }}</h2>
      <router-link
        v-if="currentTrack?.authorId"
        :to="`/channel/${currentTrack.authorId}`"
        class="track-artist"
      >
        {{ currentTrack?.author || '' }}
      </router-link>
      <span v-else class="track-artist">{{ currentTrack?.author || '' }}</span>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button class="action-btn" :class="{ active: isLiked }" @click="toggleLike">
        <FontAwesomeIcon :icon="['fas', 'thumbs-up']" />
        <span v-if="currentTrack?.likeCount">{{ formatCount(currentTrack.likeCount) }}</span>
      </button>
      <button class="action-btn" @click="toggleDislike">
        <FontAwesomeIcon :icon="['fas', 'thumbs-down']" />
      </button>
      <button class="action-btn" @click="openComments">
        <FontAwesomeIcon :icon="['fas', 'comment']" />
        <span v-if="currentTrack?.commentCount">{{ formatCount(currentTrack.commentCount) }}</span>
      </button>
      <button class="action-btn" @click="saveToPlaylist">
        <FontAwesomeIcon :icon="['fas', 'plus']" />
        <span>Save</span>
      </button>
    </div>

    <!-- Progress Bar -->
    <div class="progress-container">
      <input
        type="range"
        class="progress-bar"
        :value="currentTime"
        :max="duration"
        @input="seekTo"
      >
      <div class="time-display">
        <span>{{ formatTime(currentTime) }}</span>
        <span>{{ formatTime(duration) }}</span>
      </div>
    </div>

    <!-- Playback Controls -->
    <div class="playback-controls">
      <button
        class="control-btn"
        :class="{ active: shuffleEnabled }"
        @click="toggleShuffle"
      >
        <FontAwesomeIcon :icon="['fas', 'random']" />
      </button>
      <button class="control-btn" @click="playPrevious">
        <FontAwesomeIcon :icon="['fas', 'step-backward']" />
      </button>
      <button class="control-btn play-btn" @click="togglePlay">
        <FontAwesomeIcon :icon="isPlaying ? ['fas', 'pause'] : ['fas', 'play']" />
      </button>
      <button class="control-btn" @click="playNext">
        <FontAwesomeIcon :icon="['fas', 'step-forward']" />
      </button>
      <button
        class="control-btn"
        :class="{ active: repeatMode !== 'none' }"
        @click="cycleRepeat"
      >
        <FontAwesomeIcon :icon="repeatIcon" />
        <span v-if="repeatMode === 'one'" class="repeat-one-badge">1</span>
      </button>
    </div>

    <!-- Bottom Tabs -->
    <div class="bottom-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'queue' }"
        @click="activeTab = 'queue'"
      >
        UP NEXT
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'lyrics' }"
        @click="activeTab = 'lyrics'"
      >
        LYRICS
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'related' }"
        @click="activeTab = 'related'"
      >
        RELATED
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content" v-show="activeTab">
      <!-- Queue Tab -->
      <div v-if="activeTab === 'queue'" class="queue-list">
        <div
          v-for="(track, index) in queue"
          :key="track.videoId"
          class="queue-item"
          :class="{ current: index === queueIndex }"
          @click="playFromQueue(index)"
        >
          <img :src="getThumbUrl(track)" class="queue-thumb" :alt="track.title">
          <div class="queue-info">
            <span class="queue-title">{{ track.title }}</span>
            <span class="queue-artist">{{ track.author }}</span>
          </div>
          <button class="queue-remove" @click.stop="removeFromQueue(index)">
            <FontAwesomeIcon :icon="['fas', 'times']" />
          </button>
        </div>
        <div v-if="queue.length === 0" class="empty-state">
          <p>Queue is empty</p>
        </div>
      </div>

      <!-- Lyrics Tab -->
      <div v-if="activeTab === 'lyrics'" class="lyrics-container">
        <p class="lyrics-placeholder">Lyrics not available</p>
      </div>

      <!-- Related Tab -->
      <div v-if="activeTab === 'related'" class="related-list">
        <div
          v-for="video in relatedVideos"
          :key="video.videoId"
          class="related-item"
          @click="playRelated(video)"
        >
          <img :src="getThumbUrl(video)" class="related-thumb" :alt="video.title">
          <div class="related-info">
            <span class="related-title">{{ video.title }}</span>
            <span class="related-artist">{{ video.author }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden Audio Element -->
    <audio
      ref="audioElement"
      :src="audioSrc"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
      @play="onPlay"
      @pause="onPause"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import MusicModeToggle from '../MusicModeToggle/MusicModeToggle.vue'
import store from '../../store/index'

const router = useRouter()
const audioElement = ref(null)
const activeTab = ref('queue')
const showQueue = ref(false)
const isLiked = ref(false)
const relatedVideos = ref([])

// Store getters
const currentTrack = computed(() => store.getters.getCurrentTrack)
const queue = computed(() => store.getters.getQueue)
const queueIndex = computed(() => store.getters.getQueueIndex)
const shuffleEnabled = computed(() => store.getters.getShuffleEnabled)
const repeatMode = computed(() => store.getters.getRepeatMode)
const isPlaying = computed(() => store.getters.getIsPlaying)
const currentTime = computed(() => store.getters.getCurrentTime)
const duration = computed(() => store.getters.getDuration)

// Computed
const thumbnailUrl = computed(() => {
  if (!currentTrack.value) return ''
  const videoId = currentTrack.value.videoId
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
})

const audioSrc = computed(() => {
  // 使用 audio format URL，由 Watch component 傳入
  return currentTrack.value?.audioUrl || ''
})

const repeatIcon = computed(() => {
  return repeatMode.value === 'one'
    ? ['fas', 'redo']
    : ['fas', 'redo']
})

// Methods
function goBack() {
  router.back()
}

function shareTrack() {
  if (currentTrack.value) {
    const url = `${window.location.origin}/#/watch/${currentTrack.value.videoId}`
    navigator.clipboard?.writeText(url)
  }
}

function toggleMenu() {
  // TODO: Implement menu
}

function toggleLike() {
  isLiked.value = !isLiked.value
}

function toggleDislike() {
  // TODO: Implement dislike
}

function openComments() {
  if (currentTrack.value) {
    router.push(`/watch/${currentTrack.value.videoId}`)
  }
}

function saveToPlaylist() {
  // TODO: Implement save to playlist
}

function seekTo(event) {
  const time = parseFloat(event.target.value)
  if (audioElement.value) {
    audioElement.value.currentTime = time
  }
  store.dispatch('updateCurrentTime', time)
}

function togglePlay() {
  if (audioElement.value) {
    if (isPlaying.value) {
      audioElement.value.pause()
    } else {
      audioElement.value.play()
    }
  }
}

function playPrevious() {
  store.dispatch('playPrevious')
}

function playNext() {
  store.dispatch('playNext')
}

function toggleShuffle() {
  store.dispatch('toggleShuffle')
}

function cycleRepeat() {
  store.dispatch('cycleRepeatMode')
}

function playFromQueue(index) {
  const track = queue.value[index]
  if (track) {
    store.commit('SET_QUEUE_INDEX', index)
    store.commit('SET_CURRENT_TRACK', track)
  }
}

function removeFromQueue(index) {
  store.dispatch('removeFromQueue', index)
}

function playRelated(video) {
  store.dispatch('playTrack', video)
}

function getThumbUrl(track) {
  return `https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatCount(count) {
  if (!count) return ''
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

// Audio event handlers
function onTimeUpdate() {
  if (audioElement.value) {
    store.dispatch('updateCurrentTime', audioElement.value.currentTime)
  }
}

function onLoadedMetadata() {
  if (audioElement.value) {
    store.dispatch('updateDuration', audioElement.value.duration)
  }
}

function onEnded() {
  store.dispatch('playNext')
}

function onPlay() {
  store.dispatch('setPlaying', true)
}

function onPause() {
  store.dispatch('setPlaying', false)
}

// Watch for track changes
watch(currentTrack, (newTrack) => {
  if (newTrack && audioElement.value) {
    // Auto play new track
    audioElement.value.load()
    audioElement.value.play().catch(err => {
      console.log('[MusicPlayer] Autoplay prevented:', err.message)
    })
  }
})

// Lifecycle
onMounted(() => {
  store.dispatch('initMusicMode')
})
</script>

<style scoped>
.music-player {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #0f0f0f 100%);
  color: #fff;
  padding: 16px;
  box-sizing: border-box;
  overflow-y: auto;
}

/* Header */
.music-player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  padding: 8px;
  cursor: pointer;
  opacity: 0.8;
}

.header-btn:hover {
  opacity: 1;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Album Art */
.album-art-container {
  display: flex;
  justify-content: center;
  margin: 20px 0;
  flex-shrink: 0;
}

.album-art {
  width: 280px;
  height: 280px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease;
}

.album-art.playing {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.album-art-placeholder {
  width: 280px;
  height: 280px;
  background: #333;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80px;
  color: #666;
}

/* Track Info */
.track-info {
  text-align: center;
  margin: 20px 0;
}

.track-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 8px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist {
  font-size: 16px;
  color: #aaa;
  text-decoration: none;
}

.track-artist:hover {
  color: #fff;
  text-decoration: underline;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin: 16px 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #aaa;
  font-size: 14px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 20px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.action-btn.active {
  color: #ff0000;
}

/* Progress Bar */
.progress-container {
  margin: 20px 0;
}

.progress-bar {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #404040;
  border-radius: 2px;
  cursor: pointer;
}

.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
}

.progress-bar::-webkit-slider-runnable-track {
  background: linear-gradient(to right, #ff0000 0%, #ff0000 var(--progress, 0%), #404040 var(--progress, 0%));
}

.time-display {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #aaa;
  margin-top: 8px;
}

/* Playback Controls */
.playback-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  margin: 20px 0;
}

.control-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  padding: 12px;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s;
  position: relative;
}

.control-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.control-btn.active {
  color: #ff0000;
}

.play-btn {
  background: #fff;
  color: #000;
  border-radius: 50%;
  width: 64px;
  height: 64px;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn:hover {
  transform: scale(1.1);
}

.repeat-one-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  background: #ff0000;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Bottom Tabs */
.bottom-tabs {
  display: flex;
  justify-content: center;
  gap: 32px;
  border-top: 1px solid #333;
  padding-top: 16px;
  margin-top: auto;
}

.tab-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  padding: 8px 0;
  cursor: pointer;
  position: relative;
}

.tab-btn.active {
  color: #fff;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #fff;
}

/* Tab Content */
.tab-content {
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
  min-height: 200px;
}

/* Queue */
.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.queue-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.queue-item.current {
  background: rgba(255, 0, 0, 0.2);
}

.queue-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
}

.queue-info {
  flex: 1;
  min-width: 0;
}

.queue-title,
.queue-artist {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-title {
  font-size: 14px;
  color: #fff;
}

.queue-artist {
  font-size: 12px;
  color: #aaa;
}

.queue-remove {
  background: none;
  border: none;
  color: #aaa;
  padding: 8px;
  cursor: pointer;
}

.queue-remove:hover {
  color: #ff0000;
}

/* Related */
.related-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.related-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
}

.related-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.related-thumb {
  width: 64px;
  height: 36px;
  object-fit: cover;
  border-radius: 4px;
}

.related-info {
  flex: 1;
  min-width: 0;
}

.related-title,
.related-artist {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-title {
  font-size: 14px;
  color: #fff;
}

.related-artist {
  font-size: 12px;
  color: #aaa;
}

/* Lyrics */
.lyrics-container {
  text-align: center;
  padding: 40px 20px;
}

.lyrics-placeholder {
  color: #666;
  font-size: 16px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .music-player {
    padding: 12px;
  }

  .album-art,
  .album-art-placeholder {
    width: 240px;
    height: 240px;
  }

  .track-title {
    font-size: 18px;
  }

  .action-buttons {
    gap: 16px;
  }

  .playback-controls {
    gap: 16px;
  }

  .play-btn {
    width: 56px;
    height: 56px;
    font-size: 24px;
  }
}
</style>
