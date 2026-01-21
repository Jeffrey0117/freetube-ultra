<template>
  <div
    :class="[
      'w-[240px] overflow-y-auto h-full py-4 bg-white dark:bg-[#0f0f0f] transition-transform duration-200',
      'fixed md:relative z-30',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    ]"
  >
    <div class="flex px-3 flex-col">
      <!-- 首頁 -->
      <router-link
        to="/yt"
        class="flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#272727]"
        :class="{ 'bg-gray-200 dark:bg-[#272727]': isActive('/yt') }"
      >
        <font-awesome-icon :icon="['fas', 'home']" class="w-6 text-black dark:text-white" />
        <span class="ml-6 text-sm text-black dark:text-white">首頁</span>
      </router-link>

      <!-- 發燒影片 -->
      <router-link
        to="/yt/trending"
        class="flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#272727]"
        :class="{ 'bg-gray-200 dark:bg-[#272727]': isActive('/yt/trending') }"
      >
        <font-awesome-icon :icon="['fas', 'fire']" class="w-6 text-black dark:text-white" />
        <span class="ml-6 text-sm text-black dark:text-white">發燒影片</span>
      </router-link>

      <!-- 訂閱內容 -->
      <router-link
        to="/yt/subscriptions"
        class="flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#272727]"
        :class="{ 'bg-gray-200 dark:bg-[#272727]': isActive('/yt/subscriptions') }"
      >
        <font-awesome-icon :icon="['fas', 'users']" class="w-6 text-black dark:text-white" />
        <span class="ml-6 text-sm text-black dark:text-white">訂閱內容</span>
      </router-link>

      <hr class="my-3 border-gray-200 dark:border-[#303030]" />

      <!-- 你的頻道 -->
      <router-link
        to="/yt/library"
        class="flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#272727]"
        :class="{ 'bg-gray-200 dark:bg-[#272727]': isActive('/yt/library') }"
      >
        <font-awesome-icon :icon="['fas', 'folder']" class="w-6 text-black dark:text-white" />
        <span class="ml-6 text-sm text-black dark:text-white">媒體庫</span>
      </router-link>

      <!-- 觀看記錄 -->
      <router-link
        to="/yt/history"
        class="flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#272727]"
        :class="{ 'bg-gray-200 dark:bg-[#272727]': isActive('/yt/history') }"
      >
        <font-awesome-icon :icon="['fas', 'history']" class="w-6 text-black dark:text-white" />
        <span class="ml-6 text-sm text-black dark:text-white">觀看記錄</span>
      </router-link>

      <!-- 播放清單 -->
      <router-link
        to="/yt/playlists"
        class="flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#272727]"
        :class="{ 'bg-gray-200 dark:bg-[#272727]': isActive('/yt/playlists') }"
      >
        <font-awesome-icon :icon="['fas', 'list']" class="w-6 text-black dark:text-white" />
        <span class="ml-6 text-sm text-black dark:text-white">播放清單</span>
      </router-link>

      <hr class="my-3 border-gray-200 dark:border-[#303030]" />

      <!-- 設定 -->
      <router-link
        to="/yt/settings"
        class="flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#272727]"
        :class="{ 'bg-gray-200 dark:bg-[#272727]': isActive('/yt/settings') }"
      >
        <font-awesome-icon :icon="['fas', 'cog']" class="w-6 text-black dark:text-white" />
        <span class="ml-6 text-sm text-black dark:text-white">設定</span>
      </router-link>

      <hr class="my-3 border-gray-200 dark:border-[#303030]" />

      <div class="px-3 text-xs text-gray-500 dark:text-gray-400">
        MeeTube
      </div>
    </div>
  </div>

  <!-- Backdrop for mobile -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-20 md:hidden"
    @click="$emit('close')"
  />
</template>

<script>
export default {
  name: 'YtSidebar',
  props: {
    isOpen: {
      type: Boolean,
      default: true
    }
  },
  methods: {
    isActive(path) {
      return this.$route.path === path
    }
  }
}
</script>
