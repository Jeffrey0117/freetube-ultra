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
        v-if="currentTrack && !isLoading && !thumbnailFailed"
        :src="thumbnailUrl"
        :alt="currentTrack.title"
        class="album-art"
        :class="{ playing: isPlaying }"
        @error="onThumbnailError"
      >
      <div v-else-if="isLoading" class="album-art-placeholder loading">
        <FontAwesomeIcon :icon="['fas', 'spinner']" spin />
      </div>
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
          :class="{
            current: index === queueIndex,
            'drag-over': dragOverIndex === index
          }"
          draggable="true"
          @click="playFromQueue(index)"
          @dragstart="handleDragStart($event, index)"
          @dragover="handleDragOver($event, index)"
          @dragleave="handleDragLeave"
          @drop="handleDrop($event, index)"
          @dragend="handleDragEnd"
        >
          <FontAwesomeIcon :icon="['fas', 'grip-vertical']" class="queue-drag-handle" />
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
      @error="onError"
      @canplay="onCanPlay"
      @waiting="onWaiting"
      @stalled="onStalled"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import MusicModeToggle from '../MusicModeToggle/MusicModeToggle.vue'
import store from '../../store/index'
import { getAudioStreamUrl, videoToTrack } from '../../helpers/api/music'

const router = useRouter()
const route = useRoute()
const audioElement = ref(null)
const activeTab = ref('queue')
const showQueue = ref(false)
const isLiked = ref(false)
const relatedVideos = ref([])
const isLoading = ref(false)
const audioUrl = ref('')
const shouldAutoPlay = ref(false)
const dragOverIndex = ref(-1)
const dragStartIndex = ref(-1)
const thumbnailFallbackLevel = ref(0) // 0=maxresdefault, 1=sddefault, 2=hqdefault, 3=mqdefault
const thumbnailFailed = ref(false)

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
const thumbnailQualities = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault']

const thumbnailUrl = computed(() => {
  if (!currentTrack.value) return ''
  const videoId = currentTrack.value.videoId
  const quality = thumbnailQualities[thumbnailFallbackLevel.value] || 'mqdefault'
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`
})

const audioSrc = computed(() => {
  // 優先使用已獲取的 audioUrl，否則使用 track 上的 audioUrl
  const src = audioUrl.value || currentTrack.value?.audioUrl || ''
  console.log('[MusicPlayer] audioSrc computed:', {
    audioUrl: audioUrl.value ? audioUrl.value.substring(0, 100) + '...' : '',
    trackAudioUrl: currentTrack.value?.audioUrl ? currentTrack.value.audioUrl.substring(0, 100) + '...' : '',
    finalSrc: src ? src.substring(0, 100) + '...' : ''
  })
  return src
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

// Drag and drop handlers
function handleDragStart(event, index) {
  dragStartIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', index.toString())
  // Add a slight delay to allow the drag image to be captured
  setTimeout(() => {
    event.target.classList.add('dragging')
  }, 0)
}

function handleDragOver(event, index) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function handleDragLeave() {
  dragOverIndex.value = -1
}

function handleDrop(event, targetIndex) {
  event.preventDefault()
  const sourceIndex = dragStartIndex.value

  if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
    // Reorder the queue
    store.dispatch('reorderQueue', { fromIndex: sourceIndex, toIndex: targetIndex })
  }

  dragOverIndex.value = -1
  dragStartIndex.value = -1
}

function handleDragEnd(event) {
  event.target.classList.remove('dragging')
  dragOverIndex.value = -1
  dragStartIndex.value = -1
}

function playRelated(video) {
  store.dispatch('playTrack', video)
}

function getThumbUrl(track) {
  return `https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`
}

function onThumbnailError() {
  // Try next quality level if current one fails
  if (thumbnailFallbackLevel.value < thumbnailQualities.length - 1) {
    console.log('[MusicPlayer] Thumbnail failed to load, trying next quality:', thumbnailQualities[thumbnailFallbackLevel.value + 1])
    thumbnailFallbackLevel.value++
  } else {
    console.log('[MusicPlayer] All thumbnail qualities failed, showing placeholder')
    thumbnailFailed.value = true
  }
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
  console.log('[MusicPlayer] onLoadedMetadata fired:', {
    duration: audioElement.value?.duration,
    src: audioElement.value?.src ? audioElement.value.src.substring(0, 100) + '...' : ''
  })
  if (audioElement.value) {
    store.dispatch('updateDuration', audioElement.value.duration)
  }
}

function onEnded() {
  console.log('[MusicPlayer] onEnded fired')
  // 播放結束後嘗試播放下一首
  const nextTrack = store.getters.getNextTrack
  if (nextTrack) {
    store.dispatch('playNext')
  } else if (relatedVideos.value.length > 0) {
    // 如果沒有下一首，從相關影片中播放
    const queueIds = queue.value.map(t => t.videoId)
    const availableVideos = relatedVideos.value.filter(v => !queueIds.includes(v.videoId))
    if (availableVideos.length > 0) {
      const nextVideo = availableVideos[0]
      const track = {
        videoId: nextVideo.videoId,
        title: nextVideo.title,
        author: nextVideo.author,
        authorId: nextVideo.authorId,
        lengthSeconds: nextVideo.lengthSeconds
      }
      store.dispatch('addToQueue', track)
      store.dispatch('playNext')
    }
  }
}

function onPlay() {
  console.log('[MusicPlayer] onPlay fired')
  store.dispatch('setPlaying', true)
}

function onPause() {
  console.log('[MusicPlayer] onPause fired')
  store.dispatch('setPlaying', false)
}

function onError() {
  const audio = audioElement.value
  const error = audio?.error
  console.error('[MusicPlayer] onError fired:', {
    errorCode: error?.code,
    errorMessage: error?.message,
    src: audio?.src ? audio.src.substring(0, 100) + '...' : '',
    networkState: audio?.networkState,
    readyState: audio?.readyState
  })
  // 只在有實際的 src 且確實是 source not supported 時才跳下一首
  // 不要過於激進地跳過
}

function onCanPlay() {
  console.log('[MusicPlayer] onCanPlay fired - audio is ready to play, shouldAutoPlay:', shouldAutoPlay.value)
  if (shouldAutoPlay.value && audioElement.value) {
    shouldAutoPlay.value = false
    audioElement.value.play().catch(err => {
      console.log('[MusicPlayer] onCanPlay play() prevented:', err.message)
    })
  }
}

function onWaiting() {
  console.log('[MusicPlayer] onWaiting fired - waiting for data')
}

function onStalled() {
  console.log('[MusicPlayer] onStalled fired - download stalled')
}

// 獲取音訊串流
async function fetchAudio(videoId) {
  console.log('[MusicPlayer] fetchAudio called with videoId:', videoId)

  if (!videoId) {
    console.log('[MusicPlayer] fetchAudio: No videoId provided, returning')
    return
  }

  isLoading.value = true
  audioUrl.value = ''

  try {
    console.log('[MusicPlayer] fetchAudio: Calling getAudioStreamUrl...')
    const result = await getAudioStreamUrl(videoId)
    console.log('[MusicPlayer] fetchAudio: getAudioStreamUrl result:', {
      hasResult: !!result,
      audioUrl: result?.audioUrl ? result.audioUrl.substring(0, 100) + '...' : null,
      hasVideoInfo: !!result?.videoInfo
    })

    if (!result) {
      console.log('[MusicPlayer] fetchAudio: No result from API')
      return
    }

    audioUrl.value = result.audioUrl
    console.log('[MusicPlayer] fetchAudio: audioUrl.value set to:', audioUrl.value ? audioUrl.value.substring(0, 100) + '...' : '')

    relatedVideos.value = result.videoInfo.recommendedVideos || []

    // 如果沒有 currentTrack 或者 videoId 不同，設定新的 track
    if (!currentTrack.value || currentTrack.value.videoId !== videoId) {
      console.log('[MusicPlayer] fetchAudio: Creating new track from videoInfo')
      const track = videoToTrack(result.videoInfo, result.audioUrl)
      console.log('[MusicPlayer] fetchAudio: Track created:', {
        title: track.title,
        videoId: track.videoId,
        audioUrl: track.audioUrl ? track.audioUrl.substring(0, 100) + '...' : ''
      })
      store.dispatch('playTrack', track)
    }

    // 設定 autoplay flag，等待 canplay 事件後播放
    console.log('[MusicPlayer] fetchAudio: audioElement.value:', audioElement.value)
    if (audioElement.value) {
      console.log('[MusicPlayer] fetchAudio: Audio element src before load:', audioElement.value.src)
      shouldAutoPlay.value = true
      audioElement.value.load()
      console.log('[MusicPlayer] fetchAudio: Audio element src after load:', audioElement.value.src)
      console.log('[MusicPlayer] fetchAudio: Set shouldAutoPlay=true, waiting for canplay event')
    } else {
      console.log('[MusicPlayer] fetchAudio: No audio element available!')
    }
  } catch (error) {
    console.error('[MusicPlayer] Error fetching audio:', error)
  } finally {
    isLoading.value = false
    console.log('[MusicPlayer] fetchAudio: Finished, isLoading:', isLoading.value)
  }
}

// Watch for route changes
watch(
  () => route.params.id,
  (newId) => {
    console.log('[MusicPlayer] Route watcher triggered:', {
      newId,
      path: route.path,
      startsWithMusicPlay: route.path.startsWith('/music/play')
    })
    if (newId && route.path.startsWith('/music/play')) {
      console.log('[MusicPlayer] Route watcher: Calling fetchAudio')
      fetchAudio(newId)
    }
  },
  { immediate: true }
)

// Watch for track changes (when navigating through queue)
watch(currentTrack, (newTrack, oldTrack) => {
  console.log('[MusicPlayer] currentTrack watcher triggered:', {
    newTrackId: newTrack?.videoId,
    oldTrackId: oldTrack?.videoId,
    newTrackHasAudioUrl: !!newTrack?.audioUrl
  })
  if (newTrack && newTrack.videoId !== oldTrack?.videoId) {
    // Reset thumbnail fallback level and failed state for new track
    thumbnailFallbackLevel.value = 0
    thumbnailFailed.value = false
    // 如果 track 已經有 audioUrl，直接播放
    if (newTrack.audioUrl) {
      console.log('[MusicPlayer] Track has audioUrl, setting directly:', newTrack.audioUrl.substring(0, 100) + '...')
      audioUrl.value = newTrack.audioUrl
      if (audioElement.value) {
        console.log('[MusicPlayer] Loading audio element, waiting for canplay')
        shouldAutoPlay.value = true
        audioElement.value.load()
      } else {
        console.log('[MusicPlayer] No audio element available in track watcher!')
      }
    } else {
      // 否則獲取新的 audioUrl
      console.log('[MusicPlayer] Track has no audioUrl, fetching...')
      fetchAudio(newTrack.videoId)
    }
  }
})

// Lifecycle
onMounted(() => {
  console.log('[MusicPlayer] onMounted called')
  console.log('[MusicPlayer] audioElement.value:', audioElement.value)
  console.log('[MusicPlayer] route.params.id:', route.params.id)

  store.dispatch('initMusicMode')

  // 如果有 route param，獲取音訊
  if (route.params.id) {
    console.log('[MusicPlayer] onMounted: Calling fetchAudio with route param')
    fetchAudio(route.params.id)
  }
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
  background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80px;
  color: #555;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.album-art-placeholder.loading {
  font-size: 48px;
  color: #ff0000;
  background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
}

.album-art-container {
  position: relative;
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

/* Progress Bar - YouTube Music Style (Red) */
.progress-container {
  margin: 20px 0;
  position: relative;
}

.progress-bar {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  border-radius: 2px;
  cursor: pointer;
  outline: none;
  overflow: hidden;
}

/* WebKit (Chrome, Safari, Edge) - Track background */
.progress-bar::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: #404040;
  border-radius: 2px;
}

/* WebKit - Thumb with red fill effect */
.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #ff0000;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -4px;
  box-shadow: -1000px 0 0 1000px #ff0000;
  position: relative;
  z-index: 1;
  border: none;
}

/* Firefox - Track */
.progress-bar::-moz-range-track {
  width: 100%;
  height: 4px;
  background: #404040;
  border-radius: 2px;
  border: none;
}

/* Firefox - Filled progress portion (red) */
.progress-bar::-moz-range-progress {
  height: 4px;
  background: #ff0000;
  border-radius: 2px 0 0 2px;
}

/* Firefox - Thumb */
.progress-bar::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #ff0000;
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

/* Hover state - enlarge thumb */
.progress-bar:hover::-webkit-slider-thumb {
  transform: scale(1.3);
}

.progress-bar:hover::-moz-range-thumb {
  transform: scale(1.3);
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

.control-btn.play-btn {
  background: #fff;
  color: #000;
  border-radius: 50%;
  width: 64px;
  height: 64px;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  flex-shrink: 0;
}

/* Play icon needs slight offset to appear centered */
.control-btn.play-btn svg {
  display: block;
  color: #000;
}

.control-btn.play-btn:hover {
  transform: scale(1.1);
  background: #f0f0f0;
}

.control-btn.play-btn:active {
  transform: scale(1.05);
  background: #e0e0e0;
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

.queue-item.drag-over {
  background: rgba(255, 255, 255, 0.2);
  border: 2px dashed #ff0000;
}

.queue-item.dragging {
  opacity: 0.5;
}

.queue-drag-handle {
  color: #666;
  cursor: grab;
  padding: 4px;
  font-size: 14px;
}

.queue-drag-handle:hover {
  color: #fff;
}

.queue-item:active .queue-drag-handle {
  cursor: grabbing;
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

/* Mobile optimizations - account for fixed TopNav and SideNav bottom bar */
@media only screen and (max-width: 680px) {
  .music-player {
    padding-top: 72px; /* 60px for fixed TopNav + 12px padding */
    padding-bottom: 72px; /* 60px for fixed SideNav bottom + 12px padding */
    height: auto; /* Remove fixed height, let content flow */
    min-height: calc(100vh - 120px); /* TopNav + bottom nav */
  }
}

@media (max-width: 480px) {
  .music-player {
    padding: 12px;
    padding-top: 72px; /* Keep TopNav offset */
    padding-bottom: 72px; /* Keep bottom nav offset */
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
