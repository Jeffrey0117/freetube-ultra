<template>
  <div class="fixed inset-0 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex justify-center pt-14 min-h-[calc(100vh-56px)]">
      <div class="w-full max-w-[1800px] flex flex-col lg:flex-row px-4 lg:px-6">
        <!-- Video Area -->
        <div class="flex flex-col lg:w-[calc(100%-400px)] xl:w-[calc(100%-420px)]">
          <!-- Loading -->
          <div v-if="isLoading" class="aspect-video bg-black flex items-center justify-center rounded-xl">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>

          <!-- Video Player -->
          <div v-else class="aspect-video bg-black rounded-xl overflow-hidden">
            <ft-shaka-video-player
              v-if="!errorMessage && manifestSrc"
              ref="player"
              :manifest-src="manifestSrc"
              :manifest-mime-type="manifestMimeType"
              :legacy-formats="legacyFormats"
              :start-time="startTimeSeconds"
              :captions="captions"
              :storyboard-src="videoStoryboardSrc"
              :format="activeFormat"
              :thumbnail="thumbnail"
              :video-id="videoId"
              :chapters="videoChapters"
              :current-chapter-index="videoCurrentChapterIndex"
              :title="videoTitle"
              :theatre-possible="false"
              :use-theatre-mode="false"
              class="w-full h-full"
              @error="handlePlayerError"
              @loaded="handleVideoLoaded"
              @timeupdate="updateCurrentChapter"
              @ended="handleVideoEnded"
            />
            <div v-else-if="errorMessage" class="w-full h-full flex items-center justify-center text-white">
              <div class="text-center">
                <font-awesome-icon :icon="['fas', 'exclamation-circle']" class="text-4xl mb-2" />
                <p>{{ errorMessage }}</p>
              </div>
            </div>
            <div v-else class="w-full h-full flex items-center justify-center text-white">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          </div>

          <!-- Video Info -->
          <div class="mt-3">
            <!-- Skeleton for title -->
            <template v-if="isLoading">
              <div class="animate-pulse">
                <div class="h-6 bg-gray-200 dark:bg-[#272727] rounded w-3/4 mb-2"></div>
                <div class="h-6 bg-gray-200 dark:bg-[#272727] rounded w-1/2"></div>
              </div>
            </template>
            <h1 v-else class="text-lg md:text-xl font-semibold text-black dark:text-white line-clamp-2">
              {{ videoTitle }}
            </h1>

            <!-- Channel & Actions -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mt-3 gap-3">
              <!-- Channel Info -->
              <div class="flex items-center">
                <template v-if="isLoading">
                  <div class="animate-pulse flex items-center">
                    <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-[#272727]"></div>
                    <div class="ml-3">
                      <div class="h-4 bg-gray-200 dark:bg-[#272727] rounded w-24 mb-1"></div>
                      <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-16"></div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <router-link :to="`/yt/channel/${channelId}`" class="flex items-center">
                    <div class="h-10 w-10 rounded-full overflow-hidden bg-gray-300 dark:bg-[#303030] flex-shrink-0">
                      <img v-if="channelThumbnail" :src="channelThumbnail" :alt="channelName" class="w-full h-full object-cover" />
                    </div>
                    <div class="ml-3">
                      <span class="text-black dark:text-white font-medium flex items-center">
                        {{ channelName }}
                        <font-awesome-icon :icon="['fas', 'check-circle']" class="text-gray-500 text-xs ml-1" />
                      </span>
                      <span class="text-xs text-gray-600 dark:text-gray-400">{{ channelSubscriptionCountText }}</span>
                    </div>
                  </router-link>
                </template>
                <button
                  class="ml-6 px-4 py-2 rounded-full text-sm font-medium hover:opacity-80"
                  :class="isChannelSubscribed
                    ? 'bg-gray-200 dark:bg-[#272727] text-black dark:text-white'
                    : 'bg-black dark:bg-white text-white dark:text-black'"
                  @click="toggleSubscription"
                >
                  {{ isChannelSubscribed ? '已訂閱' : '訂閱' }}
                </button>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-2">
                <div class="flex items-center bg-gray-100 dark:bg-[#272727] rounded-full">
                  <button class="flex items-center px-4 py-2 hover:bg-gray-200 dark:hover:bg-[#3a3a3a] rounded-l-full">
                    <font-awesome-icon :icon="['fas', 'thumbs-up']" class="text-black dark:text-white" />
                    <span class="ml-2 text-black dark:text-white text-sm">{{ formatCount(videoLikeCount) }}</span>
                  </button>
                  <div class="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                  <button class="flex items-center px-4 py-2 hover:bg-gray-200 dark:hover:bg-[#3a3a3a] rounded-r-full">
                    <font-awesome-icon :icon="['fas', 'thumbs-down']" class="text-black dark:text-white" />
                  </button>
                </div>
                <button class="flex items-center px-4 py-2 bg-gray-100 dark:bg-[#272727] rounded-full hover:bg-gray-200 dark:hover:bg-[#3a3a3a]">
                  <font-awesome-icon :icon="['fas', 'share']" class="text-black dark:text-white" />
                  <span class="ml-2 text-black dark:text-white text-sm">分享</span>
                </button>
                <button class="flex items-center px-4 py-2 bg-gray-100 dark:bg-[#272727] rounded-full hover:bg-gray-200 dark:hover:bg-[#3a3a3a]">
                  <font-awesome-icon :icon="['fas', 'download']" class="text-black dark:text-white" />
                  <span class="ml-2 text-black dark:text-white text-sm">下載</span>
                </button>
                <button
                  class="flex items-center px-4 py-2 rounded-full"
                  :class="isFavorited ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-[#272727] hover:bg-gray-200 dark:hover:bg-[#3a3a3a]'"
                  @click="toggleFavorite"
                >
                  <font-awesome-icon
                    :icon="['fas', 'heart']"
                    :class="isFavorited ? 'text-red-500' : 'text-black dark:text-white'"
                  />
                  <span class="ml-2 text-sm" :class="isFavorited ? 'text-red-500' : 'text-black dark:text-white'">
                    {{ isFavorited ? '已收藏' : '收藏' }}
                  </span>
                </button>
                <button
                  class="flex items-center px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                  @click="playAsMusic"
                >
                  <font-awesome-icon :icon="['fas', 'music']" />
                  <span class="ml-2 text-sm">音樂模式</span>
                </button>
              </div>
            </div>

            <!-- Description Box -->
            <div class="mt-3 p-3 bg-gray-100 dark:bg-[#272727] rounded-xl">
              <template v-if="isLoading">
                <div class="animate-pulse">
                  <div class="h-4 bg-gray-300 dark:bg-[#303030] rounded w-1/3 mb-2"></div>
                  <div class="h-3 bg-gray-300 dark:bg-[#303030] rounded w-full mb-1"></div>
                  <div class="h-3 bg-gray-300 dark:bg-[#303030] rounded w-2/3"></div>
                </div>
              </template>
              <template v-else>
                <div class="flex text-sm text-black dark:text-white font-medium">
                  <span>{{ formatCount(videoViewCount) }} 次觀看</span>
                  <span class="mx-2">•</span>
                  <span>{{ videoPublishedText }}</span>
                </div>
                <p class="mt-2 text-sm text-black dark:text-white whitespace-pre-wrap line-clamp-3">
                  {{ videoDescription }}
                </p>
              </template>
            </div>
          </div>
        </div>

        <!-- Related Videos -->
        <div class="lg:w-[400px] xl:w-[420px] lg:pl-6 mt-6 lg:mt-0 min-h-[calc(100vh-120px)] bg-white dark:bg-[#0f0f0f]">
          <!-- Skeleton Loading -->
          <template v-if="isLoading">
            <div v-for="i in 12" :key="'skeleton-' + i" class="mb-3 flex animate-pulse">
              <div class="w-40 min-w-[160px] aspect-video rounded-lg bg-gray-200 dark:bg-[#272727]"></div>
              <div class="ml-2 flex flex-col flex-1">
                <div class="h-4 bg-gray-200 dark:bg-[#272727] rounded w-full mb-2"></div>
                <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-1/2"></div>
              </div>
            </div>
          </template>

          <!-- Actual Videos -->
          <template v-else>
            <div v-for="video in relatedVideos" :key="video.videoId" class="mb-2">
              <router-link :to="`/yt/watch/${video.videoId}`" class="flex">
                <div class="relative w-40 min-w-[160px] aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-[#272727]">
                  <img
                    :src="getVideoThumbnail(video)"
                    :alt="video.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div v-if="video.lengthSeconds" class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                    {{ formatDuration(video.lengthSeconds) }}
                  </div>
                  <div v-if="video.liveNow" class="absolute bottom-1 right-1 bg-red-600 text-white text-xs px-1 rounded">
                    直播中
                  </div>
                </div>
                <div class="ml-2 flex flex-col overflow-hidden">
                  <span class="text-sm font-medium text-black dark:text-white line-clamp-2">{{ video.title }}</span>
                  <span v-if="video.author" class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ video.author }}</span>
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    <span v-if="video.viewCount">{{ formatCount(video.viewCount) }} 次觀看</span>
                    <span v-if="video.viewCount && video.publishedText" class="mx-1">•</span>
                    <span v-if="video.publishedText">{{ formatPublishedText(video.publishedText) }}</span>
                  </div>
                </div>
              </router-link>
            </div>
            <div v-if="relatedVideos.length === 0" class="text-center text-gray-500 py-4">
              沒有推薦影片
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { YtHeader } from '../../components/yt-theme'
import FtShakaVideoPlayer from '../../components/ft-shaka-video-player/ft-shaka-video-player.vue'
import {
  invidiousGetVideoInformation,
  youtubeImageUrlToInvidious,
  mapInvidiousLegacyFormat
} from '../../helpers/api/invidious'

const MANIFEST_TYPE_DASH = 'application/dash+xml'
const MANIFEST_TYPE_HLS = 'application/x-mpegurl'

export default {
  name: 'YtWatch',
  components: {
    YtHeader,
    FtShakaVideoPlayer
  },
  data() {
    return {
      isLoading: true,
      errorMessage: '',
      videoId: '',
      videoTitle: '',
      videoDescription: '',
      videoViewCount: 0,
      videoLikeCount: 0,
      videoPublished: null,
      videoPublishedText: '',
      channelId: '',
      channelName: '',
      channelThumbnail: '',
      channelSubscriptionCountText: '',
      thumbnail: '',
      manifestSrc: null,
      manifestMimeType: MANIFEST_TYPE_DASH,
      legacyFormats: [],
      captions: [],
      videoStoryboardSrc: '',
      activeFormat: 'dash',
      videoChapters: [],
      videoCurrentChapterIndex: 0,
      startTimeSeconds: 0,
      relatedVideos: [],
      sidebarOpen: true,
      isLive: false
    }
  },
  computed: {
    currentInvidiousInstanceUrl() {
      return this.$store.getters.getCurrentInvidiousInstanceUrl
    },
    isFavorited() {
      return this.$store.getters['favorites/isFavorite'](this.videoId)
    },
    isChannelSubscribed() {
      return this.$store.getters['subscriptions/isSubscribed'](this.channelId)
    }
  },
  watch: {
    '$route.params.id': {
      handler(newId) {
        if (newId) {
          this.videoId = newId
          this.loadVideo()
        }
      },
      immediate: true
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    async loadVideo() {
      this.isLoading = true
      this.errorMessage = ''
      this.manifestSrc = null
      this.relatedVideos = []

      try {
        console.log('Loading video (Invidious API):', this.videoId)
        const result = await invidiousGetVideoInformation(this.videoId)
        console.log('Video info loaded:', result)

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.errorMessage) {
          this.errorMessage = result.errorMessage
          this.isLoading = false
          return
        }

        // Basic info
        this.videoTitle = result.title
        this.videoViewCount = result.viewCount || 0
        this.videoLikeCount = result.likeCount || 0
        this.videoDescription = result.description || ''
        this.videoPublishedText = this.formatPublishedText(result.publishedText || '')

        // Channel info
        this.channelId = result.authorId
        this.channelName = result.author
        this.channelSubscriptionCountText = result.subCountText || ''

        // Channel thumbnail
        const channelThumb = result.authorThumbnails?.[1] || result.authorThumbnails?.[0]
        if (channelThumb?.url) {
          this.channelThumbnail = channelThumb.url.includes('/ggpht') || channelThumb.url.includes('/imgproxy')
            ? channelThumb.url
            : youtubeImageUrlToInvidious(channelThumb.url, this.currentInvidiousInstanceUrl)
        }

        // Video thumbnail
        const videoThumb = result.videoThumbnails?.find(t => t.quality === 'maxres') || result.videoThumbnails?.[0]
        this.thumbnail = videoThumb?.url || `https://i.ytimg.com/vi/${this.videoId}/maxresdefault.jpg`

        // Live check
        this.isLive = !!result.liveNow

        // Streaming data
        // Legacy formats
        if (result.formatStreams?.length > 0) {
          this.legacyFormats = result.formatStreams.map(mapInvidiousLegacyFormat)
        }

        // DASH manifest - use server-provided dashUrl if available
        if (result.dashUrl) {
          // Check if it's a relative path (from local-api-server)
          if (result.dashUrl.startsWith('/')) {
            this.manifestSrc = `${window.location.origin}${result.dashUrl}`
          } else {
            this.manifestSrc = result.dashUrl
          }
          this.manifestMimeType = MANIFEST_TYPE_DASH
          this.activeFormat = 'dash'
        } else if (result.hlsUrl) {
          // For live streams
          this.manifestSrc = result.hlsUrl
          this.manifestMimeType = MANIFEST_TYPE_HLS
          this.activeFormat = 'dash'
        } else if (this.legacyFormats.length > 0) {
          // Fallback to legacy format
          this.activeFormat = 'legacy'
        } else {
          this.errorMessage = '找不到可播放的影片格式'
        }

        // Captions
        if (result.captions?.length > 0) {
          this.captions = result.captions.map(track => ({
            url: track.url,
            label: track.label,
            language_code: track.languageCode || track.language_code
          }))
        }

        // Related videos
        if (result.recommendedVideos?.length > 0) {
          this.relatedVideos = result.recommendedVideos.slice(0, 20).map(video => ({
            videoId: video.videoId,
            title: video.title,
            // Handle different possible field names for author
            author: video.author || video.authorName || video.channelTitle || '',
            authorId: video.authorId || video.channelId || '',
            viewCount: video.viewCount || video.viewCountText ? parseInt(String(video.viewCountText).replace(/[^0-9]/g, '')) : 0,
            publishedText: video.publishedText || video.publishedTimeText || '',
            lengthSeconds: video.lengthSeconds || 0,
            liveNow: video.liveNow || false
          }))
          console.log('Related videos loaded:', this.relatedVideos.length, this.relatedVideos[0])
        }

      } catch (error) {
        console.error('Failed to load video:', error)
        this.errorMessage = `載入失敗: ${error.message || '未知錯誤'}`
      }

      this.isLoading = false
    },

    handlePlayerError(error) {
      console.error('Player error:', error)
      this.errorMessage = '播放器發生錯誤'
    },

    handleVideoLoaded() {
      console.log('Video loaded successfully')
    },

    updateCurrentChapter(time) {
      // Update chapter index based on time
    },

    handleVideoEnded() {
      // Handle video end - could autoplay next
    },

    formatCount(count) {
      if (!count) return '0'
      if (count >= 100000000) return (count / 100000000).toFixed(1) + ' 億'
      if (count >= 10000) return (count / 10000).toFixed(1) + ' 萬'
      return count.toLocaleString()
    },

    formatDuration(seconds) {
      if (!seconds) return ''
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      }
      return `${m}:${s.toString().padStart(2, '0')}`
    },

    formatPublishedText(text) {
      if (!text) return ''
      return text
        .replace(/(\d+)\s*years?\s*ago/i, '$1 年前')
        .replace(/(\d+)\s*months?\s*ago/i, '$1 個月前')
        .replace(/(\d+)\s*weeks?\s*ago/i, '$1 週前')
        .replace(/(\d+)\s*days?\s*ago/i, '$1 天前')
        .replace(/(\d+)\s*hours?\s*ago/i, '$1 小時前')
        .replace(/(\d+)\s*minutes?\s*ago/i, '$1 分鐘前')
        .replace(/(\d+)\s*seconds?\s*ago/i, '$1 秒前')
        .replace(/just now/i, '剛剛')
        .replace(/Streamed/i, '直播於')
        .replace(/Premiered/i, '首播於')
    },

    getVideoThumbnail(video) {
      if (video.videoId) {
        return `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`
      }
      return ''
    },

    playAsMusic() {
      // Navigate to music player with current video
      this.$router.push(`/yt/music/play/${this.videoId}`)
    },

    toggleFavorite() {
      const video = {
        videoId: this.videoId,
        title: this.videoTitle,
        author: this.channelName,
        thumbnail: this.thumbnail,
        duration: this.videoDuration
      }
      this.$store.dispatch('favorites/toggleFavorite', video)
    },

    toggleSubscription() {
      const channel = {
        channelId: this.channelId,
        name: this.channelName,
        thumbnail: this.channelThumbnail
      }
      this.$store.dispatch('subscriptions/toggleSubscription', channel)
    }
  }
}
</script>
