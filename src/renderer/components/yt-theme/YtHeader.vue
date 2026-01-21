<template>
  <div class="sticky top-0 z-20 flex flex-row items-center justify-between h-14 px-4 md:px-5 bg-white dark:bg-[#0f0f0f]">
    <!-- Left: Menu + Logo -->
    <div class="flex h-5 items-center">
      <div
        class="flex md:mr-6 mr-4 cursor-pointer items-center justify-center h-10 w-10 rounded-full hover:bg-gray-200 dark:hover:bg-[#272727]"
        @click="toggleSidebar"
      >
        <font-awesome-icon :icon="['fas', 'bars']" class="text-black dark:text-white text-xl" />
      </div>
      <router-link to="/yt" class="flex items-center">
        <span class="text-xl font-bold text-red-600">Mee</span>
        <span class="text-xl font-bold text-black dark:text-white">Tube</span>
      </router-link>
    </div>

    <!-- Center: Search Bar -->
    <div class="group flex items-center">
      <div class="flex h-10 md:ml-10 md:pl-5 border border-gray-400 dark:border-[#303030] rounded-l-full group-focus-within:border-blue-500 md:group-focus-within:ml-5 md:group-focus-within:pl-0">
        <div class="w-10 items-center justify-center hidden group-focus-within:md:flex">
          <font-awesome-icon :icon="['fas', 'search']" class="text-black dark:text-white" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          class="bg-transparent outline-none text-black dark:text-white pr-5 pl-5 md:pl-0 w-44 md:group-focus-within:pl-0 md:w-64 lg:w-[500px]"
          placeholder="搜尋"
          @keyup.enter="handleSearch"
        />
      </div>
      <button
        class="w-16 h-10 flex items-center justify-center border border-l-0 border-gray-400 dark:border-[#303030] rounded-r-full bg-gray-100 dark:bg-[#222222] hover:bg-gray-200 dark:hover:bg-[#303030]"
        @click="handleSearch"
      >
        <font-awesome-icon :icon="['fas', 'search']" class="text-black dark:text-white" />
      </button>
    </div>

    <!-- Right: Icons + Avatar -->
    <div class="flex items-center">
      <div class="hidden md:flex">
        <div class="flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-200 dark:hover:bg-[#303030] cursor-pointer">
          <font-awesome-icon :icon="['fas', 'video']" class="text-black dark:text-white text-xl" />
        </div>
        <div class="flex items-center justify-center ml-2 h-10 w-10 rounded-full hover:bg-gray-200 dark:hover:bg-[#303030] cursor-pointer">
          <font-awesome-icon :icon="['fas', 'bell']" class="text-black dark:text-white text-xl" />
        </div>
      </div>
      <div class="flex h-8 w-8 overflow-hidden rounded-full md:ml-4 mx-1 bg-blue-500">
        <span class="w-full h-full flex items-center justify-center text-white font-semibold">
          {{ userInitial }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'YtHeader',
  data() {
    return {
      searchQuery: ''
    }
  },
  computed: {
    userInitial() {
      // TODO: Get from user settings
      return 'U'
    }
  },
  methods: {
    toggleSidebar() {
      this.$emit('toggle-sidebar')
    },
    handleSearch() {
      if (this.searchQuery.trim()) {
        this.$router.push({
          path: '/yt/search/' + encodeURIComponent(this.searchQuery)
        })
      }
    }
  }
}
</script>
