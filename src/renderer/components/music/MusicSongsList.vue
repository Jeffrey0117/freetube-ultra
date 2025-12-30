<template>
  <div class="music-songs-list">
    <div v-if="loading" class="loading-list">
      <div v-for="n in 5" :key="n" class="skeleton-song">
        <div class="skeleton-thumb-small"></div>
        <div class="skeleton-info">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    </div>

    <div v-else class="songs-list">
      <div
        v-for="song in songs"
        :key="song.id"
        class="song-item"
        @click="$emit('play', song)"
      >
        <div class="song-thumbnail">
          <img
            :src="song.thumbnail"
            :alt="song.title"
            loading="lazy"
            @error="handleImageError"
          />
        </div>

        <div class="song-info">
          <span class="song-title">{{ song.title }}</span>
          <span class="song-artist">{{ song.artist }}</span>
        </div>

        <div class="song-actions">
          <button class="action-btn" @click.stop="showMenu(song, $event)">
            <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
          </button>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div
      v-if="menuVisible"
      class="context-menu"
      :style="menuPosition"
      @click.stop
    >
      <button @click="playNext">
        <font-awesome-icon :icon="['fas', 'forward']" />
        Play Next
      </button>
      <button @click="addToQueue">
        <font-awesome-icon :icon="['fas', 'list']" />
        Add to Queue
      </button>
      <button @click="goToArtist">
        <font-awesome-icon :icon="['fas', 'user']" />
        Go to Artist
      </button>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MusicSongsList',

  props: {
    songs: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },

  emits: ['play', 'add-to-queue', 'play-next'],

  data() {
    return {
      menuVisible: false,
      menuPosition: { top: '0px', left: '0px' },
      selectedSong: null
    }
  },

  mounted() {
    document.addEventListener('click', this.hideMenu)
  },

  beforeUnmount() {
    document.removeEventListener('click', this.hideMenu)
  },

  methods: {
    handleImageError(event) {
      event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23666" font-size="40"%3E%E2%99%AA%3C/text%3E%3C/svg%3E'
    },

    showMenu(song, event) {
      this.selectedSong = song
      this.menuPosition = {
        top: `${event.clientY}px`,
        left: `${event.clientX - 150}px`
      }
      this.menuVisible = true
    },

    hideMenu() {
      this.menuVisible = false
      this.selectedSong = null
    },

    playNext() {
      if (this.selectedSong) {
        this.$emit('play-next', this.selectedSong)
      }
      this.hideMenu()
    },

    addToQueue() {
      if (this.selectedSong) {
        this.$emit('add-to-queue', this.selectedSong)
      }
      this.hideMenu()
    },

    goToArtist() {
      if (this.selectedSong?.artistId) {
        this.$router.push(`/channel/${this.selectedSong.artistId}`)
      }
      this.hideMenu()
    }
  }
})
</script>

<style scoped>
.music-songs-list {
  position: relative;
}

.songs-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.song-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.song-thumbnail {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.song-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-title {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 12px;
  color: #aaaaaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-actions {
  flex-shrink: 0;
}

.action-btn {
  background: transparent;
  border: none;
  color: #aaaaaa;
  padding: 8px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background-color: #282828;
  border-radius: 8px;
  padding: 8px 0;
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.context-menu button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}

.context-menu button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* Loading skeleton */
.loading-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-song {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
}

.skeleton-thumb-small {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line.short {
  width: 60%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
