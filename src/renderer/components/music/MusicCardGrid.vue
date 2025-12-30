<template>
  <div class="music-card-grid-container">
    <div v-if="loading" class="loading-grid">
      <div v-for="n in 9" :key="n" class="skeleton-card">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-text"></div>
      </div>
    </div>

    <div v-else class="music-card-grid">
      <div
        v-for="item in items"
        :key="item.id"
        class="music-card"
        @click="$emit('play', item)"
      >
        <div class="card-thumbnail">
          <img
            :src="item.thumbnail"
            :alt="item.title"
            loading="lazy"
            @error="handleImageError"
          />
          <div class="card-overlay">
            <font-awesome-icon :icon="['fas', 'play']" class="play-icon" />
          </div>
        </div>
        <div class="card-info">
          <span class="card-title">{{ item.title }}</span>
          <span class="card-artist">{{ item.artist }}</span>
        </div>
      </div>
    </div>

    <!-- Pagination dots -->
    <div v-if="!loading && items.length > 0" class="pagination-dots">
      <span class="dot active"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MusicCardGrid',

  props: {
    items: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },

  emits: ['play'],

  methods: {
    handleImageError(event) {
      event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23666" font-size="40"%3E%E2%99%AA%3C/text%3E%3C/svg%3E'
    }
  }
})
</script>

<style scoped>
.music-card-grid-container {
  padding: 0 4px;
}

.music-card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.music-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background-color: #1a1a1a;
  transition: transform 0.2s, box-shadow 0.2s;
}

.music-card:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.card-thumbnail {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.music-card:hover .card-overlay {
  opacity: 1;
}

.play-icon {
  font-size: 32px;
  color: #ffffff;
}

.card-info {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-artist {
  font-size: 12px;
  color: #aaaaaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Loading skeleton */
.loading-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.skeleton-card {
  background-color: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
}

.skeleton-thumb {
  aspect-ratio: 1;
  background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-text {
  height: 40px;
  margin: 10px;
  background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Pagination dots */
.pagination-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #555;
}

.dot.active {
  background-color: #ffffff;
}

/* Responsive */
@media (max-width: 600px) {
  .music-card-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .loading-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
