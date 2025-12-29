<template>
  <div class="music-mode-toggle">
    <button
      class="toggle-btn"
      :class="{ active: !isMusicMode }"
      @click="setMode(false)"
    >
      <FontAwesomeIcon :icon="['fas', 'video']" />
      <span class="toggle-label">Video</span>
    </button>
    <button
      class="toggle-btn"
      :class="{ active: isMusicMode }"
      @click="setMode(true)"
    >
      <FontAwesomeIcon :icon="['fas', 'music']" />
      <span class="toggle-label">Music</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import store from '../../store/index'

const isMusicMode = computed(() => store.getters.getIsMusicMode)

function setMode(musicMode) {
  if (isMusicMode.value !== musicMode) {
    store.dispatch('toggleMusicMode')
  }
}
</script>

<style scoped>
.music-mode-toggle {
  display: flex;
  background: var(--side-nav-color, #212121);
  border-radius: 20px;
  padding: 4px;
  gap: 4px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: var(--tertiary-text-color, #aaa);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.toggle-btn.active {
  background: var(--primary-color, #fff);
  color: var(--side-nav-color, #212121);
}

.toggle-label {
  font-weight: 500;
}

/* Mobile: hide labels */
@media (max-width: 480px) {
  .toggle-btn {
    padding: 8px 12px;
  }

  .toggle-label {
    display: none;
  }
}
</style>
