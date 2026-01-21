<template>
  <div class="fixed inset-0 flex flex-col bg-white dark:bg-[#0f0f0f]">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Content Area -->
      <main class="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f0f]">
        <slot />
      </main>
    </div>
  </div>
</template>

<script>
import YtHeader from './YtHeader.vue'
import YtSidebar from './YtSidebar.vue'

export default {
  name: 'YtLayout',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      sidebarOpen: true
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    }
  }
}
</script>
