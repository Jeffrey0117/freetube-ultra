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
    <div class="group flex items-center relative">
      <div class="flex h-10 md:ml-10 md:pl-5 border border-gray-400 dark:border-[#303030] rounded-l-full group-focus-within:border-blue-500 md:group-focus-within:ml-5 md:group-focus-within:pl-0">
        <div class="w-10 items-center justify-center hidden group-focus-within:md:flex">
          <font-awesome-icon :icon="['fas', 'search']" class="text-black dark:text-white" />
        </div>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="bg-transparent outline-none text-black dark:text-white pr-5 pl-5 md:pl-0 w-44 md:group-focus-within:pl-0 md:w-64 lg:w-[500px]"
          placeholder="搜尋"
          autocomplete="off"
          @input="onSearchInput"
          @keyup.enter="handleSearch"
          @keydown.down.prevent="navigateSuggestion(1)"
          @keydown.up.prevent="navigateSuggestion(-1)"
          @focus="showSuggestions = true"
          @blur="hideSuggestionsDelayed"
        />
      </div>
      <button
        class="w-16 h-10 flex items-center justify-center border border-l-0 border-gray-400 dark:border-[#303030] rounded-r-full bg-gray-100 dark:bg-[#222222] hover:bg-gray-200 dark:hover:bg-[#303030]"
        @click="handleSearch"
      >
        <font-awesome-icon :icon="['fas', 'search']" class="text-black dark:text-white" />
      </button>

      <!-- Search Suggestions Dropdown -->
      <div
        v-if="showSuggestions && suggestions.length > 0"
        class="absolute top-full left-0 md:left-10 right-0 mt-1 bg-white dark:bg-[#212121] border border-gray-200 dark:border-[#303030] rounded-lg shadow-lg overflow-hidden z-50"
      >
        <div
          v-for="(suggestion, index) in suggestions"
          :key="index"
          class="flex items-center px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#303030]"
          :class="{ 'bg-gray-100 dark:bg-[#303030]': index === selectedIndex }"
          @mousedown.prevent="selectSuggestion(suggestion)"
        >
          <font-awesome-icon :icon="['fas', 'search']" class="text-gray-400 mr-3 text-sm" />
          <span class="text-black dark:text-white text-sm">{{ suggestion }}</span>
        </div>
      </div>
    </div>

    <!-- Right: Icons + Avatar -->
    <div class="flex items-center">
      <div class="hidden md:flex">
        <!-- Music Mode Button -->
        <router-link
          to="/yt/music"
          class="flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-200 dark:hover:bg-[#303030] cursor-pointer"
          title="音樂模式"
        >
          <font-awesome-icon :icon="['fas', 'music']" class="text-black dark:text-white text-xl" />
        </router-link>
        <div class="flex items-center justify-center ml-2 h-10 w-10 rounded-full hover:bg-gray-200 dark:hover:bg-[#303030] cursor-pointer">
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
import { invidiousAPICall } from '../../helpers/api/invidious'

export default {
  name: 'YtHeader',
  data() {
    return {
      searchQuery: '',
      suggestions: [],
      showSuggestions: false,
      selectedIndex: -1,
      debounceTimer: null
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

    onSearchInput() {
      // Debounce search suggestions
      clearTimeout(this.debounceTimer)
      this.selectedIndex = -1

      if (!this.searchQuery.trim()) {
        this.suggestions = []
        return
      }

      this.debounceTimer = setTimeout(() => {
        this.fetchSuggestions()
      }, 200)
    },

    async fetchSuggestions() {
      try {
        const response = await invidiousAPICall({
          resource: 'search/suggestions',
          id: '',
          params: { q: this.searchQuery }
        })
        if (response && response.suggestions) {
          this.suggestions = response.suggestions.slice(0, 8)
        }
      } catch (e) {
        console.error('Failed to fetch suggestions:', e)
        this.suggestions = []
      }
    },

    navigateSuggestion(direction) {
      if (this.suggestions.length === 0) return

      this.selectedIndex += direction
      if (this.selectedIndex < 0) {
        this.selectedIndex = this.suggestions.length - 1
      } else if (this.selectedIndex >= this.suggestions.length) {
        this.selectedIndex = 0
      }

      // Update search query to selected suggestion
      this.searchQuery = this.suggestions[this.selectedIndex]
    },

    selectSuggestion(suggestion) {
      this.searchQuery = suggestion
      this.showSuggestions = false
      this.handleSearch()
    },

    hideSuggestionsDelayed() {
      setTimeout(() => {
        this.showSuggestions = false
      }, 150)
    },

    handleSearch() {
      if (this.searchQuery.trim()) {
        this.showSuggestions = false
        this.$router.push({
          path: '/yt/search/' + encodeURIComponent(this.searchQuery.trim())
        })
      }
    }
  }
}
</script>
