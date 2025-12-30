<template>
  <nav class="music-bottom-nav">
    <router-link
      v-for="tab in tabs"
      :key="tab.id"
      :to="tab.route"
      :class="['nav-item', { active: active === tab.id }]"
    >
      <font-awesome-icon :icon="tab.icon" class="nav-icon" />
      <span class="nav-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MusicBottomNav',

  props: {
    active: {
      type: String,
      default: 'home'
    }
  },

  data() {
    return {
      tabs: [
        { id: 'home', label: 'Home', icon: ['fas', 'home'], route: '/music' },
        { id: 'hot', label: 'Hot', icon: ['fas', 'fire'], route: '/music/trending' },
        { id: 'search', label: 'Search', icon: ['fas', 'search'], route: '/music/search' },
        { id: 'library', label: 'Library', icon: ['fas', 'bookmark'], route: '/music/library' }
      ]
    }
  }
})
</script>

<style scoped>
.music-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: #0f0f0f;
  border-top: 1px solid #282828;
  padding: 8px 0;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  z-index: 100;
}

/* Hide on mobile - SideNav already provides bottom navigation */
@media only screen and (max-width: 680px) {
  .music-bottom-nav {
    display: none;
  }
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  color: #aaaaaa;
  text-decoration: none;
  transition: color 0.2s;
  min-width: 64px;
}

.nav-item:hover,
.nav-item.active {
  color: #ffffff;
}

.nav-icon {
  font-size: 20px;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
}

/* Router link active state */
.nav-item.router-link-exact-active {
  color: #ffffff;
}
</style>
