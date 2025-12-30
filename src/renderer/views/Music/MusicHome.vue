<template>
  <div class="music-home">
    <!-- Header -->
    <music-header />

    <!-- Category Pills -->
    <music-category-pills
      :categories="categories"
      :selected="selectedCategory"
      @select="onCategorySelect"
    />

    <!-- Quick Picks Section -->
    <section class="music-section">
      <div class="section-header">
        <h2>{{ $t('Music.Quick Picks') }}</h2>
        <span class="section-arrow">
          <font-awesome-icon :icon="['fas', 'chevron-right']" />
        </span>
      </div>
      <music-card-grid
        :items="quickPicks"
        :loading="loadingQuickPicks"
        @play="playMusic"
      />
    </section>

    <!-- Songs List Section -->
    <section class="music-section">
      <div class="section-header">
        <h2>{{ $t('Music.Songs') }}</h2>
        <button class="play-all-btn" @click="playAllSongs">
          {{ $t('Music.Play All') }}
        </button>
      </div>
      <music-songs-list
        :songs="songsList"
        :loading="loadingSongs"
        @play="playMusic"
        @add-to-queue="addToQueue"
      />
    </section>

    <!-- Bottom Navigation -->
    <music-bottom-nav :active="'home'" />
  </div>
</template>

<script src="./MusicHome.js" />
<style scoped src="./MusicHome.css" />
