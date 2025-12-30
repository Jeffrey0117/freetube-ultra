<template>
  <header class="music-header">
    <div class="music-logo" @click="goHome">
      <font-awesome-icon :icon="['fas', 'music']" class="logo-icon" />
      <span class="logo-text">Music</span>
    </div>

    <div class="header-actions">
      <button class="header-btn" @click="openSearch">
        <font-awesome-icon :icon="['fas', 'search']" />
      </button>
      <button class="header-btn" @click="openSettings">
        <font-awesome-icon :icon="['fas', 'user-circle']" />
      </button>
    </div>
  </header>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MusicHeader',

  methods: {
    goHome() {
      this.$router.push('/music')
    },

    openSearch() {
      this.$router.push('/music/search')
    },

    openSettings() {
      this.$router.push('/settings')
    }
  }
})
</script>

<style scoped>
.music-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: var(--music-bg, #0f0f0f);
  position: sticky;
  top: 0;
  z-index: 100;
}

.music-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.logo-icon {
  font-size: 24px;
  color: #ff0000;
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-btn {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 20px;
  padding: 8px;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.header-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
