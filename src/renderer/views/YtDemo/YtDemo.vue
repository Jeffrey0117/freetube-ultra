<template>
  <YtLayout>
    <div class="p-4">
      <!-- Video Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <!-- Skeleton Loading -->
        <template v-if="isLoading">
          <div v-for="i in 12" :key="'skeleton-' + i" class="animate-pulse">
            <div class="aspect-video rounded-xl bg-gray-200 dark:bg-[#272727]"></div>
            <div class="flex mt-3">
              <div class="h-9 w-9 rounded-full bg-gray-200 dark:bg-[#272727] flex-shrink-0"></div>
              <div class="ml-3 flex-1">
                <div class="h-4 bg-gray-200 dark:bg-[#272727] rounded w-full mb-2"></div>
                <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </template>

        <!-- Actual Videos -->
        <template v-else>
          <YtVideoCard
            v-for="video in videos"
            :key="video.videoId"
            :video="video"
          />
        </template>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && videos.length === 0" class="text-center py-8 text-gray-500">
        找不到影片
      </div>
    </div>
  </YtLayout>
</template>

<script>
import { YtLayout, YtVideoCard } from '../../components/yt-theme'

export default {
  name: 'YtDemo',
  components: {
    YtLayout,
    YtVideoCard
  },
  data() {
    return {
      videos: [],
      isLoading: true
    }
  },
  async mounted() {
    await this.fetchVideos()
  },
  methods: {
    async fetchVideos() {
      this.isLoading = true
      try {
        // Try to fetch from API
        const response = await fetch('/api/v1/popular/')
        if (response.ok) {
          const data = await response.json()
          this.videos = data.slice(0, 20)
        }
      } catch (e) {
        console.error('Failed to fetch videos:', e)
        // Use mock data for testing
        this.videos = this.getMockVideos()
      }
      this.isLoading = false
    },
    getMockVideos() {
      return [
        {
          videoId: 'dQw4w9WgXcQ',
          title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
          author: 'Rick Astley',
          authorId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
          lengthSeconds: 213,
          viewCount: 1400000000,
          publishedText: '14 years ago',
          videoThumbnails: [
            { quality: 'medium', url: '/vi/dQw4w9WgXcQ/mqdefault.jpg' }
          ],
          authorThumbnails: []
        },
        {
          videoId: 'jNQXAC9IVRw',
          title: 'Me at the zoo',
          author: 'jawed',
          authorId: 'UC4QobU6STFB0P71PMvOGN5A',
          lengthSeconds: 19,
          viewCount: 280000000,
          publishedText: '18 years ago',
          videoThumbnails: [
            { quality: 'medium', url: '/vi/jNQXAC9IVRw/mqdefault.jpg' }
          ],
          authorThumbnails: []
        }
      ]
    }
  }
}
</script>
