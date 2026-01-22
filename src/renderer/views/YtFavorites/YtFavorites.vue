<template>
  <div class="fixed inset-0 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex pt-14">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Favorites Content -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <!-- Title -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center">
            <font-awesome-icon :icon="['fas', 'heart']" class="text-red-500 text-2xl mr-3" />
            <h1 class="text-2xl font-bold text-black dark:text-white">我的收藏</h1>
          </div>
          <span class="text-gray-500 dark:text-gray-400">{{ favorites.length }} 部影片</span>
        </div>

        <!-- Empty State -->
        <div v-if="favorites.length === 0" class="flex flex-col items-center justify-center py-20">
          <font-awesome-icon :icon="['fas', 'heart']" class="text-gray-300 dark:text-gray-600 text-6xl mb-4" />
          <p class="text-gray-500 dark:text-gray-400 text-lg">還沒有收藏任何影片</p>
          <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">在觀看影片時點擊愛心即可收藏</p>
          <router-link to="/yt" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700">
            探索影片
          </router-link>
        </div>

        <!-- Favorites Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="video in favorites"
            :key="video.videoId"
            class="group relative"
          >
            <router-link :to="`/yt/watch/${video.videoId}`" class="block">
              <div class="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#272727]">
                <img
                  :src="video.thumbnail"
                  :alt="video.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div v-if="video.duration" class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                  {{ formatDuration(video.duration) }}
                </div>
              </div>
              <div class="mt-2">
                <h3 class="text-sm font-medium text-black dark:text-white line-clamp-2">{{ video.title }}</h3>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ video.author }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-500 mt-0.5">收藏於 {{ formatDate(video.addedAt) }}</p>
              </div>
            </router-link>

            <!-- Remove Button -->
            <button
              class="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
              @click.prevent="removeFavorite(video.videoId)"
              title="移除收藏"
            >
              <font-awesome-icon :icon="['fas', 'times']" />
            </button>
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
  name: 'YtFavorites',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      sidebarOpen: true
    }
  },
  computed: {
    ...mapGetters('favorites', ['getFavorites']),
    favorites() {
      return this.getFavorites
    }
  },
  methods: {
    ...mapActions('favorites', ['removeFavorite']),

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
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

    formatDate(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }
}
</script>
