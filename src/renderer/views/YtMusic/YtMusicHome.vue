<template>
  <div class="fixed inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <div class="sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-[#1a1a2e]/90 backdrop-blur-sm">
      <div class="flex items-center">
        <router-link to="/yt" class="flex items-center justify-center h-10 w-10 rounded-full hover:bg-white/10">
          <font-awesome-icon :icon="['fas', 'arrow-left']" class="text-white text-xl" />
        </router-link>
        <span class="ml-4 text-xl font-bold text-white">MeeTube Music</span>
      </div>
      <div class="flex items-center">
        <router-link to="/yt/music/search" class="flex items-center justify-center h-10 w-10 rounded-full hover:bg-white/10">
          <font-awesome-icon :icon="['fas', 'search']" class="text-white text-xl" />
        </router-link>
      </div>
    </div>

    <!-- Main Content -->
    <div class="p-4">
      <!-- Now Playing Mini Bar (if something is playing) -->
      <div
        v-if="currentTrack"
        class="mb-6 p-4 bg-white/10 rounded-xl flex items-center cursor-pointer hover:bg-white/15"
        @click="goToPlayer"
      >
        <img :src="currentTrack.thumbnail" class="h-12 w-12 rounded object-cover" />
        <div class="ml-3 flex-1 overflow-hidden">
          <div class="text-white font-medium truncate">{{ currentTrack.title }}</div>
          <div class="text-gray-400 text-sm truncate">{{ currentTrack.author }}</div>
        </div>
        <button
          class="h-10 w-10 flex items-center justify-center rounded-full bg-white text-black"
          @click.stop="togglePlayPause"
        >
          <font-awesome-icon :icon="['fas', isPlaying ? 'pause' : 'play']" />
        </button>
      </div>

      <!-- Trending Music -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-white mb-4">熱門音樂</h2>

        <!-- Skeleton Loading -->
        <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div v-for="i in 10" :key="'skeleton-' + i" class="animate-pulse">
            <div class="aspect-square rounded-lg bg-white/10"></div>
            <div class="h-4 bg-white/10 rounded w-3/4 mt-2"></div>
            <div class="h-3 bg-white/10 rounded w-1/2 mt-1"></div>
          </div>
        </div>

        <!-- Music Grid -->
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div
            v-for="video in musicVideos"
            :key="video.videoId"
            class="group cursor-pointer"
            @click="playMusic(video)"
          >
            <div class="relative aspect-square rounded-lg overflow-hidden bg-white/10">
              <img
                :src="getThumbnail(video)"
                :alt="video.title"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div class="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center">
                  <font-awesome-icon :icon="['fas', 'play']" class="text-white text-xl ml-1" />
                </div>
              </div>
              <div v-if="video.lengthSeconds" class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                {{ formatDuration(video.lengthSeconds) }}
              </div>
            </div>
            <h3 class="text-white text-sm font-medium mt-2 line-clamp-2">{{ video.title }}</h3>
            <p class="text-gray-400 text-xs mt-1">{{ video.author }}</p>
          </div>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-white mb-4">快速開始</h2>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="genre in genres"
            :key="genre"
            class="px-4 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            @click="searchGenre(genre)"
          >
            {{ genre }}
          </button>
        </div>
      </section>
    </div>

    <!-- Audio Element -->
    <audio
      ref="audioPlayer"
      :src="audioUrl"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @loadedmetadata="onLoadedMetadata"
    />
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import { getAudioStreamUrl } from '../../helpers/api/music'

export default {
  name: 'YtMusicHome',
  data() {
    return {
      musicVideos: [],
      isLoading: true,
      audioUrl: '',
      genres: ['流行音樂', '嘻哈', '搖滾', '電子', '古典', 'K-Pop', 'J-Pop', '中文歌曲']
    }
  },
  computed: {
    ...mapState('musicMode', ['currentTrack', 'isPlaying', 'queue'])
  },
  async mounted() {
    await this.fetchTrendingMusic()
  },
  methods: {
    ...mapActions('musicMode', ['playTrack', 'togglePlayPause', 'setQueue']),

    async fetchTrendingMusic() {
      this.isLoading = true
      try {
        // Fetch trending/popular videos from local API
        const response = await fetch('/api/v1/trending')
        if (response.ok) {
          const data = await response.json()
          if (data && Array.isArray(data)) {
            this.musicVideos = data.filter(v => v.type === 'video').slice(0, 20)
          }
        }
      } catch (e) {
        console.error('Failed to fetch trending music:', e)
      }
      this.isLoading = false
    },

    async playMusic(video) {
      try {
        // Get audio stream URL
        const { audioUrl, videoInfo } = await getAudioStreamUrl(video.videoId)

        const track = {
          videoId: video.videoId,
          title: video.title,
          author: video.author,
          thumbnail: this.getThumbnail(video),
          duration: video.lengthSeconds || 0,
          audioUrl
        }

        // Set queue with all music videos
        const queue = this.musicVideos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          author: v.author,
          thumbnail: this.getThumbnail(v),
          duration: v.lengthSeconds || 0
        }))

        this.setQueue(queue)
        this.playTrack(track)

        // Navigate to player
        this.$router.push(`/yt/music/play/${video.videoId}`)
      } catch (e) {
        console.error('Failed to play music:', e)
      }
    },

    goToPlayer() {
      if (this.currentTrack) {
        this.$router.push(`/yt/music/play/${this.currentTrack.videoId}`)
      }
    },

    searchGenre(genre) {
      this.$router.push(`/yt/search/${encodeURIComponent(genre + ' music')}`)
    },

    getThumbnail(video) {
      if (video.videoId) {
        return `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`
      }
      return ''
    },

    formatDuration(seconds) {
      if (!seconds) return ''
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      return `${m}:${s.toString().padStart(2, '0')}`
    },

    onTimeUpdate() {
      // Sync with store if needed
    },

    onEnded() {
      // Play next track
    },

    onLoadedMetadata() {
      // Duration loaded
    }
  }
}
</script>
