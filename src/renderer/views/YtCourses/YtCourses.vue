<template>
  <div class="fixed inset-0 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex pt-14">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Courses Content -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <!-- Title & Create Button -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center">
            <font-awesome-icon :icon="['fas', 'graduation-cap']" class="text-blue-500 text-2xl mr-3" />
            <h1 class="text-2xl font-bold text-black dark:text-white">我的課程</h1>
          </div>
          <button
            class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
            @click="showCreateModal = true"
          >
            <font-awesome-icon :icon="['fas', 'plus']" class="mr-2" />
            建立課程
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="courses.length === 0" class="flex flex-col items-center justify-center py-20">
          <font-awesome-icon :icon="['fas', 'graduation-cap']" class="text-gray-300 dark:text-gray-600 text-6xl mb-4" />
          <p class="text-gray-500 dark:text-gray-400 text-lg">還沒有建立任何課程</p>
          <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">輸入關鍵字自動搜尋並建立課程</p>
          <button
            class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
            @click="showCreateModal = true"
          >
            建立第一個課程
          </button>
        </div>

        <!-- Courses Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <router-link
            v-for="course in courses"
            :key="course.id"
            :to="`/yt/courses/${course.id}`"
            class="group block"
          >
            <div class="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#272727]">
              <img
                v-if="course.thumbnail"
                :src="course.thumbnail"
                :alt="course.name"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <font-awesome-icon :icon="['fas', 'graduation-cap']" class="text-gray-400 text-4xl" />
              </div>
              <!-- Overlay -->
              <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div class="text-white text-center">
                  <font-awesome-icon :icon="['fas', 'play-circle']" class="text-4xl mb-2" />
                  <div class="text-sm">{{ course.videos.length }} 部影片</div>
                  <div v-if="course.series.length > 0" class="text-xs text-gray-300 mt-1">
                    {{ course.series.length }} 個系列
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-2">
              <h3 class="text-sm font-medium text-black dark:text-white line-clamp-2">{{ course.name }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                關鍵字：{{ course.keyword }}
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                建立於 {{ formatDate(course.createdAt) }}
              </p>
            </div>
          </router-link>
        </div>
      </main>
    </div>

    <!-- Create Course Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showCreateModal = false"
    >
      <div class="bg-white dark:bg-[#212121] rounded-xl p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold text-black dark:text-white mb-4">建立新課程</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">課程名稱</label>
            <input
              v-model="newCourse.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#121212] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如：Python 入門教學"
            />
          </div>

          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">搜尋關鍵字</label>
            <input
              v-model="newCourse.keyword"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#121212] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如：Python 教學"
              @keyup.enter="createCourse"
            />
            <p class="text-xs text-gray-500 mt-1">系統會自動搜尋相關影片並整理成課程</p>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <button
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg"
            @click="showCreateModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canCreate || isCreating"
            @click="createCourse"
          >
            <template v-if="isCreating">
              <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
              搜尋中...
            </template>
            <template v-else>
              搜尋並建立
            </template>
          </button>
        </div>

        <!-- Error Message -->
        <div v-if="createError" class="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {{ createError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { YtHeader, YtSidebar } from '../../components/yt-theme'

export default {
  name: 'YtCourses',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      sidebarOpen: true,
      showCreateModal: false,
      newCourse: {
        name: '',
        keyword: ''
      },
      createError: ''
    }
  },
  computed: {
    ...mapGetters('courses', ['getCourses', 'isCreating']),
    courses() {
      return this.getCourses
    },
    canCreate() {
      return this.newCourse.name.trim() && this.newCourse.keyword.trim()
    }
  },
  methods: {
    ...mapActions('courses', ['createCourse']),

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    async createCourse() {
      if (!this.canCreate || this.isCreating) return

      this.createError = ''

      const result = await this.$store.dispatch('courses/createCourse', {
        name: this.newCourse.name.trim(),
        keyword: this.newCourse.keyword.trim()
      })

      if (result.success) {
        this.showCreateModal = false
        this.newCourse = { name: '', keyword: '' }
        // 導航到新建立的課程
        this.$router.push(`/yt/courses/${result.course.id}`)
      } else {
        this.createError = result.error
      }
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
