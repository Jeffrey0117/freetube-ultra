<template>
  <div class="fixed inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f0f] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between h-14 px-4">
      <button class="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/10" @click="goBack">
        <font-awesome-icon :icon="['fas', 'chevron-down']" class="text-white text-xl" />
      </button>
      <div class="text-white text-sm font-medium">正在播放</div>
      <button class="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/10">
        <font-awesome-icon :icon="['fas', 'ellipsis-v']" class="text-white" />
      </button>
    </div>

    <!-- Album Art -->
    <div class="flex-1 flex items-center justify-center px-8 py-4">
      <div class="w-full max-w-sm aspect-square rounded-lg overflow-hidden shadow-2xl" :class="{ 'animate-pulse-slow': isPlaying }">
        <img
          v-if="currentTrack"
          :src="currentTrack.thumbnail || getThumbnail(videoId)"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full bg-white/10 flex items-center justify-center">
          <font-awesome-icon :icon="['fas', 'music']" class="text-white/30 text-6xl" />
        </div>
      </div>
    </div>

    <!-- Track Info -->
    <div class="px-6 text-center">
      <h1 class="text-white text-xl font-bold line-clamp-2">{{ currentTrack?.title || '未選擇歌曲' }}</h1>
      <p class="text-gray-400 mt-1">{{ currentTrack?.author || '' }}</p>
    </div>

    <!-- Progress Bar -->
    <div class="px-6 mt-6">
      <input
        type="range"
        class="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-600"
        :value="currentTime"
        :max="duration || 100"
        @input="seekTo"
      />
      <div class="flex justify-between text-xs text-gray-400 mt-1">
        <span>{{ formatTime(currentTime) }}</span>
        <span>{{ formatTime(duration) }}</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center justify-center gap-6 py-8">
      <button
        class="h-12 w-12 flex items-center justify-center rounded-full hover:bg-white/10"
        :class="{ 'text-red-500': shuffleEnabled, 'text-white': !shuffleEnabled }"
        @click="toggleShuffle"
      >
        <font-awesome-icon :icon="['fas', 'random']" class="text-xl" />
      </button>

      <button class="h-14 w-14 flex items-center justify-center rounded-full hover:bg-white/10 text-white" @click="playPrevious">
        <font-awesome-icon :icon="['fas', 'step-backward']" class="text-2xl" />
      </button>

      <button
        class="h-16 w-16 flex items-center justify-center rounded-full bg-white text-black"
        @click="togglePlayPause"
      >
        <font-awesome-icon :icon="['fas', isPlaying ? 'pause' : 'play']" class="text-2xl" :class="{ 'ml-1': !isPlaying }" />
      </button>

      <button class="h-14 w-14 flex items-center justify-center rounded-full hover:bg-white/10 text-white" @click="playNext">
        <font-awesome-icon :icon="['fas', 'step-forward']" class="text-2xl" />
      </button>

      <button
        class="h-12 w-12 flex items-center justify-center rounded-full hover:bg-white/10"
        :class="repeatModeClass"
        @click="toggleRepeat"
      >
        <font-awesome-icon :icon="repeatIcon" class="text-xl" />
      </button>
    </div>

    <!-- Queue Preview -->
    <div class="px-6 pb-6">
      <div class="flex items-center justify-between mb-3">
        <span class="text-white font-medium">播放佇列</span>
        <span class="text-gray-400 text-sm">{{ (queue || []).length }} 首歌曲</span>
      </div>
      <div class="space-y-2 max-h-40 overflow-y-auto">
        <div
          v-for="(track, index) in (queue || []).slice(0, 5)"
          :key="track.videoId"
          class="flex items-center p-2 rounded-lg hover:bg-white/10 cursor-pointer"
          :class="{ 'bg-white/10': track.videoId === currentTrack?.videoId }"
          @click="playFromQueue(index)"
        >
          <img :src="track.thumbnail || getThumbnail(track.videoId)" class="h-10 w-10 rounded object-cover" />
          <div class="ml-3 flex-1 overflow-hidden">
            <div class="text-white text-sm truncate">{{ track.title }}</div>
            <div class="text-gray-400 text-xs truncate">{{ track.author }}</div>
          </div>
          <span v-if="track.videoId === currentTrack?.videoId" class="text-red-500">
            <font-awesome-icon :icon="['fas', 'volume-up']" />
          </span>
        </div>
      </div>
    </div>

    <!-- Hidden Audio Element -->
    <audio
      ref="audioPlayer"
      :src="audioUrl"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @loadedmetadata="onLoadedMetadata"
      @error="onError"
    />
  </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex'
import { getAudioStreamUrl } from '../../helpers/api/music'

export default {
  name: 'YtMusicPlayer',
  data() {
    return {
      videoId: '',
      audioUrl: '',
      currentTime: 0,
      duration: 0,
      isLoadingAudio: false
    }
  },
  computed: {
    ...mapState('musicMode', ['currentTrack', 'isPlaying', 'queue', 'queueIndex', 'shuffleEnabled', 'repeatMode']),

    repeatModeClass() {
      return {
        'text-red-500': this.repeatMode !== 'none',
        'text-white': this.repeatMode === 'none'
      }
    },

    repeatIcon() {
      return this.repeatMode === 'one' ? ['fas', 'redo-alt'] : ['fas', 'redo']
    }
  },
  watch: {
    '$route.params.id': {
      handler(newId) {
        if (newId) {
          this.videoId = newId
          this.loadTrack()
        }
      },
      immediate: true
    },
    isPlaying(playing) {
      if (this.$refs.audioPlayer) {
        if (playing) {
          this.$refs.audioPlayer.play().catch(e => console.error('Play error:', e))
        } else {
          this.$refs.audioPlayer.pause()
        }
      }
    },
    currentTrack(track) {
      if (track && track.audioUrl) {
        this.audioUrl = track.audioUrl
        this.$nextTick(() => {
          if (this.isPlaying && this.$refs.audioPlayer) {
            this.$refs.audioPlayer.play().catch(e => console.error('Play error:', e))
          }
        })
      }
    }
  },
  methods: {
    ...mapActions('musicMode', ['playTrack', 'togglePlayPause', 'playNext', 'playPrevious', 'toggleShuffle', 'toggleRepeat']),
    ...mapMutations('musicMode', ['SET_CURRENT_TIME', 'SET_DURATION']),

    async loadTrack() {
      if (!this.videoId) return

      // Check if already playing this track
      if (this.currentTrack?.videoId === this.videoId && this.currentTrack?.audioUrl) {
        this.audioUrl = this.currentTrack.audioUrl
        return
      }

      this.isLoadingAudio = true
      try {
        const { audioUrl, videoInfo } = await getAudioStreamUrl(this.videoId)
        this.audioUrl = audioUrl

        const track = {
          videoId: this.videoId,
          title: videoInfo?.title || 'Unknown',
          author: videoInfo?.author || 'Unknown',
          thumbnail: this.getThumbnail(this.videoId),
          duration: videoInfo?.lengthSeconds || 0,
          audioUrl
        }

        this.playTrack(track)
      } catch (e) {
        console.error('Failed to load track:', e)
      }
      this.isLoadingAudio = false
    },

    goBack() {
      this.$router.push('/yt/music')
    },

    playFromQueue(index) {
      const track = this.queue[index]
      if (track) {
        this.loadTrackFromQueue(track)
      }
    },

    async loadTrackFromQueue(track) {
      if (track.audioUrl) {
        this.playTrack(track)
        this.audioUrl = track.audioUrl
      } else {
        // Need to fetch audio URL
        try {
          const { audioUrl } = await getAudioStreamUrl(track.videoId)
          const updatedTrack = { ...track, audioUrl }
          this.playTrack(updatedTrack)
          this.audioUrl = audioUrl
        } catch (e) {
          console.error('Failed to load track:', e)
        }
      }
    },

    seekTo(event) {
      const time = parseFloat(event.target.value)
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.currentTime = time
      }
      this.currentTime = time
    },

    onTimeUpdate() {
      if (this.$refs.audioPlayer) {
        this.currentTime = this.$refs.audioPlayer.currentTime
        this.SET_CURRENT_TIME(this.currentTime)
      }
    },

    onLoadedMetadata() {
      if (this.$refs.audioPlayer) {
        this.duration = this.$refs.audioPlayer.duration
        this.SET_DURATION(this.duration)
      }
    },

    async onEnded() {
      if (this.repeatMode === 'one') {
        this.$refs.audioPlayer.currentTime = 0
        this.$refs.audioPlayer.play()
      } else {
        await this.playNext()
        // Load audio for next track
        if (this.currentTrack && !this.currentTrack.audioUrl) {
          await this.loadTrackFromQueue(this.currentTrack)
        }
      }
    },

    onError(e) {
      console.error('Audio error:', e)
    },

    getThumbnail(videoId) {
      return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    },

    formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00'
      const m = Math.floor(seconds / 60)
      const s = Math.floor(seconds % 60)
      return `${m}:${s.toString().padStart(2, '0')}`
    }
  }
}
</script>

<style scoped>
.animate-pulse-slow {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
}
</style>
