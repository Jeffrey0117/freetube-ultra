<template>
  <router-link :to="`/yt/watch/${video.videoId}`" class="block">
    <div class="flex flex-col mb-4">
      <!-- Thumbnail -->
      <div class="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#272727]">
        <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          :alt="video.title"
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <div
          v-if="video.lengthSeconds"
          class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded font-medium"
        >
          {{ formatDuration(video.lengthSeconds) }}
        </div>
        <div
          v-if="video.liveNow"
          class="absolute bottom-1 right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium"
        >
          LIVE
        </div>
      </div>

      <!-- Info -->
      <div class="flex mt-3">
        <!-- Channel Avatar -->
        <div class="flex-shrink-0 h-9 w-9 rounded-full overflow-hidden bg-gray-300 dark:bg-[#303030]">
          <img
            v-if="channelThumbnail"
            :src="channelThumbnail"
            :alt="video.author"
            class="w-full h-full object-cover"
          />
        </div>

        <!-- Text Info -->
        <div class="flex flex-col ml-3 overflow-hidden">
          <span class="text-sm font-medium line-clamp-2 text-black dark:text-white leading-5">
            {{ video.title }}
          </span>
          <span class="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center">
            {{ video.author }}
            <span v-if="video.authorVerified" class="ml-1">
              <font-awesome-icon :icon="['fas', 'check-circle']" class="text-gray-500 text-[10px]" />
            </span>
          </span>
          <div class="flex text-xs text-gray-600 dark:text-gray-400">
            <span>{{ formatViews(video.viewCount) }} 次觀看</span>
            <span class="mx-1">•</span>
            <span>{{ formatPublishedText(video.publishedText) || formatPublished(video.published) }}</span>
          </div>
        </div>
      </div>
    </div>
  </router-link>
</template>

<script>
export default {
  name: 'YtVideoCard',
  props: {
    video: {
      type: Object,
      required: true
    }
  },
  computed: {
    thumbnailUrl() {
      if (this.video.videoThumbnails && this.video.videoThumbnails.length > 0) {
        // Prefer medium quality
        const medium = this.video.videoThumbnails.find(t => t.quality === 'medium' || t.quality === 'mqdefault')
        return medium?.url || this.video.videoThumbnails[0].url
      }
      return ''
    },
    channelThumbnail() {
      if (this.video.authorThumbnails && this.video.authorThumbnails.length > 0) {
        return this.video.authorThumbnails[0].url
      }
      return ''
    }
  },
  methods: {
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
    formatViews(count) {
      if (!count) return '0'
      if (count >= 100000000) return (count / 100000000).toFixed(1) + ' 億'
      if (count >= 10000) return (count / 10000).toFixed(1) + ' 萬'
      return count.toLocaleString()
    },
    formatPublishedText(text) {
      if (!text) return ''
      // Convert English time format to Chinese
      return text
        .replace(/(\d+)\s*years?\s*ago/i, '$1 年前')
        .replace(/(\d+)\s*months?\s*ago/i, '$1 個月前')
        .replace(/(\d+)\s*weeks?\s*ago/i, '$1 週前')
        .replace(/(\d+)\s*days?\s*ago/i, '$1 天前')
        .replace(/(\d+)\s*hours?\s*ago/i, '$1 小時前')
        .replace(/(\d+)\s*minutes?\s*ago/i, '$1 分鐘前')
        .replace(/(\d+)\s*seconds?\s*ago/i, '$1 秒前')
        .replace(/just now/i, '剛剛')
        .replace(/streamed/i, '直播於')
        .replace(/premiered/i, '首播於')
    },
    formatPublished(timestamp) {
      if (!timestamp) return ''
      const now = Date.now()
      const diff = now - timestamp
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      const months = Math.floor(days / 30)
      const years = Math.floor(days / 365)

      if (years > 0) return `${years} 年前`
      if (months > 0) return `${months} 個月前`
      if (days > 0) return `${days} 天前`
      if (hours > 0) return `${hours} 小時前`
      if (minutes > 0) return `${minutes} 分鐘前`
      return '剛剛'
    }
  }
}
</script>
