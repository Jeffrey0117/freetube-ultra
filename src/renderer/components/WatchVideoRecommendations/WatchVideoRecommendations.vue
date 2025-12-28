<template>
  <div class="watchVideoRecommendations">
    <div class="VideoRecommendationsTopBar">
      <h3>
        {{ $t("Up Next") }}
      </h3>
    </div>
    <FtListVideoLazy
      v-for="video in data"
      :key="video.videoId"
      :data="video"
      appearance="recommendation"
      force-list-type="list"
      :use-channels-hidden-preference="true"
      @pause-player="pausePlayer"
    />
  </div>
</template>

<script setup>

import FtListVideoLazy from '../FtListVideoLazy.vue'

defineProps({
  data: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['pause-player'])

function pausePlayer() {
  emit('pause-player')
}
</script>

<style scoped src="./WatchVideoRecommendations.css" />
