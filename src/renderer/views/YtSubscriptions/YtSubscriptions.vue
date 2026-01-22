<template>
  <div class="fixed inset-0 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex pt-14">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Subscriptions Content -->
      <main class="flex-1 overflow-hidden">
        <!-- Title Bar -->
        <div class="flex items-center justify-between p-4 lg:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center">
            <font-awesome-icon :icon="['fas', 'users']" class="text-red-500 text-xl mr-3" />
            <div>
              <h1 class="text-xl font-bold text-black dark:text-white">訂閱內容</h1>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ subscriptionCount }} 個頻道</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <!-- View Mode Toggle -->
            <div class="flex items-center bg-gray-100 dark:bg-[#272727] rounded-full p-1">
              <button
                :class="viewMode === 'cards'
                  ? 'bg-white dark:bg-[#3a3a3a] shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-[#303030]'"
                class="px-3 py-1.5 rounded-full text-sm font-medium text-black dark:text-white transition-all"
                @click="viewMode = 'cards'"
              >
                <font-awesome-icon :icon="['fas', 'th-large']" class="mr-1" />
                卡片
              </button>
              <button
                :class="viewMode === 'expanded'
                  ? 'bg-white dark:bg-[#3a3a3a] shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-[#303030]'"
                class="px-3 py-1.5 rounded-full text-sm font-medium text-black dark:text-white transition-all"
                @click="viewMode = 'expanded'"
              >
                <font-awesome-icon :icon="['fas', 'columns']" class="mr-1" />
                展開
              </button>
            </div>

            <!-- Time Filter (only in expanded mode) -->
            <div v-if="viewMode === 'expanded'" class="flex items-center gap-1">
              <button
                v-for="filter in filters"
                :key="filter.value"
                :class="currentFilter === filter.value
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-gray-100 dark:bg-[#272727] text-black dark:text-white hover:bg-gray-200 dark:hover:bg-[#303030]'"
                class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                @click="setFilter(filter.value)"
              >
                {{ filter.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="subscriptionCount === 0" class="flex flex-col items-center justify-center py-20">
          <font-awesome-icon :icon="['fas', 'users']" class="text-gray-300 dark:text-gray-600 text-6xl mb-4" />
          <p class="text-gray-500 dark:text-gray-400 text-lg">還沒有訂閱任何頻道</p>
          <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">在頻道頁面點擊「訂閱」按鈕來訂閱頻道</p>
          <router-link
            to="/yt"
            class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            探索影片
          </router-link>
        </div>

        <!-- Cards View Mode -->
        <div v-else-if="viewMode === 'cards'" class="p-4 lg:p-6 overflow-y-auto h-[calc(100vh-130px)]">
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <router-link
              v-for="channel in subscribedChannels"
              :key="channel.channelId"
              :to="`/yt/channel/${channel.channelId}`"
              class="group flex flex-col items-center p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-[#272727] transition-colors"
            >
              <div class="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-[#272727] ring-2 ring-transparent group-hover:ring-red-500 transition-all">
                <img
                  v-if="channel.thumbnail"
                  :src="channel.thumbnail"
                  :alt="channel.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <font-awesome-icon :icon="['fas', 'user']" class="text-gray-400 text-3xl" />
                </div>
              </div>
              <h3 class="mt-3 text-sm font-medium text-black dark:text-white text-center line-clamp-2">
                {{ channel.name }}
              </h3>
              <p v-if="channel.subscriberCount" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ formatCount(channel.subscriberCount) }} 訂閱者
              </p>
            </router-link>
          </div>
        </div>

        <!-- Expanded View Mode -->
        <div v-else class="h-[calc(100vh-130px)] flex flex-col">
          <!-- Loading -->
          <div v-if="isLoadingFeed" class="flex items-center justify-center h-full">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-gray-400 mr-3" />
            <span class="text-gray-500 dark:text-gray-400">載入訂閱影片中...</span>
          </div>

          <!-- Channel Columns with scrollbar at top -->
          <div v-else class="flex-1 overflow-x-auto overflow-y-hidden scrollbar-top">
            <div class="flex gap-4 p-4 lg:p-6 h-full scrollbar-top-content">
            <div
              v-for="channel in channelsWithVideos"
              :key="channel.channelId"
              class="flex-shrink-0 w-72 flex flex-col bg-gray-50 dark:bg-[#181818] rounded-xl overflow-hidden"
            >
              <!-- Channel Header -->
              <router-link
                :to="`/yt/channel/${channel.channelId}`"
                class="flex items-center p-3 bg-white dark:bg-[#212121] hover:bg-gray-100 dark:hover:bg-[#272727] transition-colors"
              >
                <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-[#272727] flex-shrink-0">
                  <img
                    v-if="channel.thumbnail"
                    :src="channel.thumbnail"
                    :alt="channel.name"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="ml-3 min-w-0">
                  <h3 class="text-sm font-medium text-black dark:text-white truncate">{{ channel.name }}</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ getChannelVideoCount(channel.channelId) }} 部影片
                  </p>
                </div>
              </router-link>

              <!-- Videos List -->
              <div class="flex-1 overflow-y-auto p-2 space-y-2">
                <router-link
                  v-for="video in getChannelVideos(channel.channelId)"
                  :key="video.videoId"
                  :to="`/yt/watch/${video.videoId}`"
                  class="block group"
                >
                  <div class="relative aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-[#272727]">
                    <img
                      :src="video.thumbnail"
                      :alt="video.title"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div v-if="video.duration" class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                      {{ formatDuration(video.duration) }}
                    </div>
                    <!-- New Badge -->
                    <div v-if="isNew(video.published)" class="absolute top-1 left-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                      新
                    </div>
                  </div>
                  <h4 class="mt-1.5 text-xs font-medium text-black dark:text-white line-clamp-2 group-hover:text-blue-500">
                    {{ video.title }}
                  </h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ formatCount(video.viewCount) }} 次觀看・{{ video.publishedText || formatTimeAgo(video.published) }}
                  </p>
                </router-link>

                <!-- No videos -->
                <div v-if="getChannelVideos(channel.channelId).length === 0" class="flex flex-col items-center justify-center py-8 text-center">
                  <font-awesome-icon :icon="['fas', 'video-slash']" class="text-gray-300 dark:text-gray-600 text-2xl mb-2" />
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ currentFilter === 'all' ? '沒有影片' : '沒有新影片' }}
                  </p>
                </div>
              </div>
            </div>

              <!-- No channels with videos message -->
              <div v-if="channelsWithVideos.length === 0" class="flex items-center justify-center w-full py-20">
                <div class="text-center">
                  <font-awesome-icon :icon="['fas', 'video-slash']" class="text-gray-300 dark:text-gray-600 text-4xl mb-3" />
                  <p class="text-gray-500 dark:text-gray-400">目前篩選條件下沒有影片</p>
                  <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">嘗試切換到「全部」查看所有影片</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { YtHeader, YtSidebar } from '../../components/yt-theme'

export default {
  name: 'YtSubscriptions',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      sidebarOpen: true,
      viewMode: 'cards', // 'cards' | 'expanded'
      filters: [
        { value: 'all', label: '全部' },
        { value: '30days', label: '30天' },
        { value: '7days', label: '7天' }
      ]
    }
  },
  computed: {
    ...mapGetters('subscriptions', [
      'getSubscribedChannels',
      'getFeedVideos',
      'isLoadingFeed',
      'getFeedFilter',
      'getSubscriptionCount'
    ]),
    subscribedChannels() {
      return this.getSubscribedChannels || []
    },
    channelsWithVideos() {
      return this.subscribedChannels.filter(channel => this.getChannelVideos(channel.channelId).length > 0)
    },
    feedVideos() {
      return this.getFeedVideos || []
    },
    currentFilter() {
      return this.getFeedFilter || '7days'
    },
    subscriptionCount() {
      return this.getSubscriptionCount || 0
    }
  },
  watch: {
    viewMode(newMode) {
      // Load feed when switching to expanded mode
      if (newMode === 'expanded' && this.feedVideos.length === 0) {
        this.loadSubscriptionFeed()
      }
    }
  },
  methods: {
    ...mapActions('subscriptions', ['loadSubscriptionFeed', 'setFeedFilter']),

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    setFilter(filter) {
      this.setFeedFilter(filter)
    },

    getChannelVideos(channelId) {
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000

      let videos = this.feedVideos.filter(v => v.authorId === channelId)

      // Apply time filter
      switch (this.currentFilter) {
        case '7days':
          videos = videos.filter(v => now - v.published < 7 * oneDay)
          break
        case '30days':
          videos = videos.filter(v => now - v.published < 30 * oneDay)
          break
      }

      return videos
    },

    getChannelVideoCount(channelId) {
      return this.getChannelVideos(channelId).length
    },

    isNew(timestamp) {
      if (!timestamp) return false
      const threeDays = 3 * 24 * 60 * 60 * 1000
      return Date.now() - timestamp < threeDays
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
    },

    formatTimeAgo(timestamp) {
      if (!timestamp) return ''
      const now = Date.now()
      const diff = now - timestamp
      const minute = 60 * 1000
      const hour = 60 * minute
      const day = 24 * hour
      const week = 7 * day
      const month = 30 * day
      const year = 365 * day

      if (diff < hour) return `${Math.floor(diff / minute)} 分鐘前`
      if (diff < day) return `${Math.floor(diff / hour)} 小時前`
      if (diff < week) return `${Math.floor(diff / day)} 天前`
      if (diff < month) return `${Math.floor(diff / week)} 週前`
      if (diff < year) return `${Math.floor(diff / month)} 個月前`
      return `${Math.floor(diff / year)} 年前`
    }
  }
}
</script>

<style scoped>
/* Scrollbar at top - flip container, then flip content back */
.scrollbar-top {
  transform: scaleY(-1);
}
.scrollbar-top-content {
  transform: scaleY(-1);
}

/* Horizontal scrollbar styling */
.scrollbar-top::-webkit-scrollbar {
  height: 10px;
}
.scrollbar-top::-webkit-scrollbar-track {
  background: rgba(128, 128, 128, 0.1);
  border-radius: 5px;
}
.scrollbar-top::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
  border-radius: 5px;
}
.scrollbar-top::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.6);
}

/* Vertical scrollbar for channel columns */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
}
</style>
