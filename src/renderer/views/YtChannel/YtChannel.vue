<template>
  <div class="fixed inset-0 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex pt-14">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Channel Content -->
      <main class="flex-1 overflow-y-auto">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-20">
          <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-gray-400" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="flex flex-col items-center justify-center py-20">
          <font-awesome-icon :icon="['fas', 'exclamation-circle']" class="text-gray-300 dark:text-gray-600 text-6xl mb-4" />
          <p class="text-gray-500 dark:text-gray-400 text-lg">{{ error }}</p>
          <button
            class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
            @click="loadChannel"
          >
            重試
          </button>
        </div>

        <template v-else-if="channel">
          <!-- Channel Banner -->
          <div v-if="channel.authorBanners && channel.authorBanners.length > 0" class="w-full h-32 md:h-48 lg:h-56">
            <img
              :src="getBannerUrl()"
              alt="Channel Banner"
              class="w-full h-full object-cover"
            />
          </div>

          <!-- Channel Info -->
          <div class="px-4 lg:px-6 py-4">
            <div class="flex flex-col md:flex-row md:items-center gap-4">
              <!-- Avatar -->
              <div class="flex-shrink-0">
                <img
                  :src="channel.authorThumbnails?.[channel.authorThumbnails.length - 1]?.url || ''"
                  :alt="channel.author"
                  class="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover"
                />
              </div>

              <!-- Info -->
              <div class="flex-1">
                <h1 class="text-2xl font-bold text-black dark:text-white">{{ channel.author }}</h1>
                <div class="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span>@{{ channel.authorId }}</span>
                  <span v-if="channel.subCount">・{{ formatCount(channel.subCount) }} 位訂閱者</span>
                  <span v-if="channel.totalViews">・{{ formatCount(channel.totalViews) }} 次觀看</span>
                </div>
                <p v-if="channel.description" class="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                  {{ channel.description }}
                </p>
              </div>

              <!-- Subscribe Button -->
              <div class="flex-shrink-0">
                <button
                  :class="isChannelSubscribed
                    ? 'bg-gray-200 dark:bg-[#272727] text-black dark:text-white'
                    : 'bg-black dark:bg-white text-white dark:text-black'"
                  class="px-6 py-2.5 rounded-full font-medium hover:opacity-90 transition-opacity"
                  @click="handleSubscribe"
                >
                  {{ isChannelSubscribed ? '已訂閱' : '訂閱' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6">
            <div class="flex gap-6 overflow-x-auto">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                :class="currentTab === tab.id
                  ? 'border-b-2 border-black dark:border-white text-black dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'"
                class="py-3 px-1 text-sm font-medium whitespace-nowrap"
                @click="currentTab = tab.id"
              >
                {{ tab.name }}
              </button>
            </div>
          </div>

          <!-- Tab Content -->
          <div class="p-4 lg:p-6">
            <!-- Videos Tab -->
            <div v-if="currentTab === 'videos'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <router-link
                v-for="video in videos"
                :key="video.videoId"
                :to="`/yt/watch/${video.videoId}`"
                class="group block"
              >
                <div class="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#272727]">
                  <img
                    :src="`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`"
                    :alt="video.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div v-if="video.lengthSeconds" class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                    {{ formatDuration(video.lengthSeconds) }}
                  </div>
                </div>
                <div class="mt-2">
                  <h3 class="text-sm font-medium text-black dark:text-white line-clamp-2">{{ video.title }}</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ formatCount(video.viewCount) }} 次觀看・{{ video.publishedText }}
                  </p>
                </div>
              </router-link>

              <!-- Load More -->
              <div v-if="hasMoreVideos" class="col-span-full flex justify-center py-4">
                <button
                  class="px-6 py-2 bg-gray-100 dark:bg-[#272727] text-black dark:text-white rounded-full hover:bg-gray-200 dark:hover:bg-[#303030]"
                  :disabled="isLoadingMore"
                  @click="loadMoreVideos"
                >
                  <template v-if="isLoadingMore">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                    載入中...
                  </template>
                  <template v-else>
                    載入更多
                  </template>
                </button>
              </div>
            </div>

            <!-- About Tab -->
            <div v-if="currentTab === 'about'" class="max-w-2xl">
              <h2 class="text-lg font-bold text-black dark:text-white mb-4">關於</h2>
              <p class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{{ channel.description || '此頻道沒有說明' }}</p>

              <div class="mt-6 space-y-3">
                <div v-if="channel.joined" class="flex items-center text-sm">
                  <span class="text-gray-500 dark:text-gray-400 w-24">加入日期</span>
                  <span class="text-black dark:text-white">{{ channel.joined }}</span>
                </div>
                <div v-if="channel.totalViews" class="flex items-center text-sm">
                  <span class="text-gray-500 dark:text-gray-400 w-24">總觀看次數</span>
                  <span class="text-black dark:text-white">{{ formatCount(channel.totalViews) }} 次</span>
                </div>
                <div v-if="channel.location" class="flex items-center text-sm">
                  <span class="text-gray-500 dark:text-gray-400 w-24">位置</span>
                  <span class="text-black dark:text-white">{{ channel.location }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'vuex'
import { YtHeader, YtSidebar } from '../../components/yt-theme'

export default {
  name: 'YtChannel',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      sidebarOpen: true,
      isLoading: false,
      isLoadingMore: false,
      error: '',
      channel: null,
      videos: [],
      videoContinuation: null,
      currentTab: 'videos',
      tabs: [
        { id: 'videos', name: '影片' },
        { id: 'about', name: '關於' }
      ]
    }
  },
  computed: {
    channelId() {
      return this.$route.params.id
    },
    hasMoreVideos() {
      return !!this.videoContinuation
    },
    isChannelSubscribed() {
      return this.$store.getters['subscriptions/isSubscribed'](this.channelId)
    }
  },
  watch: {
    channelId: {
      immediate: true,
      handler() {
        this.loadChannel()
      }
    }
  },
  methods: {
    ...mapActions('subscriptions', ['subscribeChannel', 'unsubscribeChannel', 'toggleSubscription']),

    async loadChannel() {
      this.isLoading = true
      this.error = ''
      this.channel = null
      this.videos = []
      this.videoContinuation = null

      try {
        // Fetch channel info
        const response = await fetch(`/api/v1/channels/${this.channelId}`)
        if (!response.ok) throw new Error('無法載入頻道資訊')

        this.channel = await response.json()

        // Fetch videos
        await this.loadVideos()
      } catch (e) {
        console.error('[YtChannel] Failed to load channel:', e)
        this.error = e.message || '載入失敗'
      }

      this.isLoading = false
    },

    async loadVideos() {
      try {
        let url = `/api/v1/channels/${this.channelId}/videos?sortBy=newest`
        if (this.videoContinuation) {
          url += `&continuation=${this.videoContinuation}`
        }

        const response = await fetch(url)
        if (!response.ok) return

        const data = await response.json()
        if (data.videos) {
          this.videos.push(...data.videos)
        }
        this.videoContinuation = data.continuation || null
      } catch (e) {
        console.error('[YtChannel] Failed to load videos:', e)
      }
    },

    async loadMoreVideos() {
      if (this.isLoadingMore || !this.videoContinuation) return

      this.isLoadingMore = true
      await this.loadVideos()
      this.isLoadingMore = false
    },

    handleSubscribe() {
      if (!this.channel) return

      this.toggleSubscription({
        channelId: this.channelId,
        name: this.channel.author,
        thumbnail: this.channel.authorThumbnails?.[this.channel.authorThumbnails.length - 1]?.url || '',
        subscriberCount: this.channel.subCount || 0,
        videoCount: this.videos.length || 0
      })
    },

    getBannerUrl() {
      if (!this.channel?.authorBanners?.length) return ''
      // Get the largest banner
      const banners = this.channel.authorBanners
      return banners[banners.length - 1]?.url || banners[0]?.url || ''
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

    formatCount(count) {
      if (!count) return '0'
      if (count >= 100000000) return `${(count / 100000000).toFixed(1)}億`
      if (count >= 10000) return `${(count / 10000).toFixed(1)}萬`
      if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
      return count.toString()
    }
  }
}
</script>
