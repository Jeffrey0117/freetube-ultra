<template>
  <div class="fixed inset-0 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex pt-14">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Course Content -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <!-- Not Found -->
        <div v-if="!course" class="flex flex-col items-center justify-center py-20">
          <font-awesome-icon :icon="['fas', 'exclamation-circle']" class="text-gray-300 dark:text-gray-600 text-6xl mb-4" />
          <p class="text-gray-500 dark:text-gray-400 text-lg">找不到此課程</p>
          <router-link to="/yt/courses" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
            返回課程列表
          </router-link>
        </div>

        <template v-else>
          <!-- Course Header -->
          <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div class="flex items-center mb-4 md:mb-0">
              <router-link to="/yt/courses" class="mr-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <font-awesome-icon :icon="['fas', 'arrow-left']" class="text-xl" />
              </router-link>
              <div>
                <h1 class="text-2xl font-bold text-black dark:text-white">{{ course.name }}</h1>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ course.videos.length }} 部影片
                  <span v-if="course.series.length > 0">・{{ course.series.length }} 個系列</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="flex items-center px-4 py-2 bg-gray-100 dark:bg-[#272727] text-black dark:text-white rounded-full hover:bg-gray-200 dark:hover:bg-[#303030]"
                :disabled="isSearching"
                @click="handleRefresh"
              >
                <font-awesome-icon
                  :icon="['fas', 'sync-alt']"
                  class="mr-2"
                  :class="{ 'animate-spin': isSearching }"
                />
                {{ isSearching ? '更新中...' : '重新整理' }}
              </button>
              <button
                class="flex items-center px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50"
                @click="confirmDelete"
              >
                <font-awesome-icon :icon="['fas', 'trash']" class="mr-2" />
                刪除課程
              </button>
            </div>
          </div>

          <!-- Series Sections -->
          <template v-if="course.series.length > 0">
            <div v-for="series in course.series" :key="series.id" class="mb-8">
              <h2 class="text-lg font-semibold text-black dark:text-white mb-3 flex items-center">
                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-blue-500 mr-2" />
                {{ series.name }}
                <span class="ml-2 text-sm text-gray-500 font-normal">({{ series.videoIds.length }} 部)</span>
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <router-link
                  v-for="videoId in series.videoIds"
                  :key="videoId"
                  :to="`/yt/watch/${videoId}`"
                  class="group block"
                >
                  <!-- Inline Video Card -->
                  <template v-if="getVideoById(videoId)">
                    <div class="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#272727]">
                      <img
                        :src="getVideoById(videoId).thumbnail"
                        :alt="getVideoById(videoId).title"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div v-if="getVideoById(videoId).duration" class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                        {{ formatDuration(getVideoById(videoId).duration) }}
                      </div>
                    </div>
                    <div class="mt-2">
                      <h3 class="text-sm font-medium text-black dark:text-white line-clamp-2">{{ getVideoById(videoId).title }}</h3>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ getVideoById(videoId).author }}</p>
                    </div>
                  </template>
                </router-link>
              </div>
            </div>
          </template>

          <!-- Non-Series Videos -->
          <div v-if="nonSeriesVideos.length > 0" class="mb-8">
            <h2 v-if="course.series.length > 0" class="text-lg font-semibold text-black dark:text-white mb-3">
              其他影片
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <router-link
                v-for="video in nonSeriesVideos"
                :key="video.videoId"
                :to="`/yt/watch/${video.videoId}`"
                class="group block"
              >
                <!-- Inline Video Card -->
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
                </div>
              </router-link>
            </div>
          </div>

          <!-- No Videos Message -->
          <div v-if="course.videos.length === 0" class="text-center py-12">
            <font-awesome-icon :icon="['fas', 'video-slash']" class="text-gray-300 dark:text-gray-600 text-4xl mb-4" />
            <p class="text-gray-500 dark:text-gray-400">此課程沒有影片</p>
            <button
              class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
              @click="handleRefresh"
            >
              重新搜尋
            </button>
          </div>
        </template>
      </main>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showDeleteModal = false"
    >
      <div class="bg-white dark:bg-[#212121] rounded-xl p-6 w-full max-w-sm mx-4">
        <h2 class="text-xl font-bold text-black dark:text-white mb-4">刪除課程</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          確定要刪除「{{ course?.name }}」嗎？此操作無法復原。
        </p>
        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg"
            @click="showDeleteModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            @click="handleDelete"
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { YtHeader, YtSidebar } from '../../components/yt-theme'

export default {
  name: 'YtCourseDetail',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      sidebarOpen: true,
      showDeleteModal: false
    }
  },
  computed: {
    ...mapGetters('courses', ['getCourseById', 'isSearching']),
    courseId() {
      return this.$route.params.id
    },
    course() {
      return this.getCourseById(this.courseId)
    },
    nonSeriesVideos() {
      if (!this.course) return []
      return this.course.videos.filter(v => !v.seriesGroup)
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    getVideoById(videoId) {
      if (!this.course) return null
      return this.course.videos.find(v => v.videoId === videoId)
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

    async handleRefresh() {
      await this.$store.dispatch('courses/refreshCourse', this.courseId)
    },

    confirmDelete() {
      this.showDeleteModal = true
    },

    async handleDelete() {
      await this.$store.dispatch('courses/deleteCourse', this.courseId)
      this.$router.push('/yt/courses')
    }
  }
}
</script>
