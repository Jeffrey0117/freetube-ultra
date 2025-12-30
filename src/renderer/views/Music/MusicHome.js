import { defineComponent } from 'vue'
import { mapActions } from 'vuex'
import MusicHeader from '../../components/music/MusicHeader.vue'
import MusicCategoryPills from '../../components/music/MusicCategoryPills.vue'
import MusicCardGrid from '../../components/music/MusicCardGrid.vue'
import MusicSongsList from '../../components/music/MusicSongsList.vue'
import MusicBottomNav from '../../components/music/MusicBottomNav.vue'

export default defineComponent({
  name: 'MusicHome',

  components: {
    MusicHeader,
    MusicCategoryPills,
    MusicCardGrid,
    MusicSongsList,
    MusicBottomNav
  },

  data() {
    return {
      selectedCategory: 'trending',
      categories: [
        { id: 'trending', label: 'Trending' },
        { id: 'chill', label: 'Chill' },
        { id: 'workout', label: 'Workout' },
        { id: 'focus', label: 'Focus' },
        { id: 'party', label: 'Party' },
        { id: 'podcast', label: 'Podcast' }
      ],
      quickPicks: [],
      songsList: [],
      loadingQuickPicks: true,
      loadingSongs: true
    }
  },

  mounted() {
    this.fetchMusicData()
  },

  methods: {
    ...mapActions([
      'playVideo',
      'addToMusicQueue'
    ]),

    async fetchMusicData() {
      this.loadingQuickPicks = true
      this.loadingSongs = true

      try {
        // Fetch trending music
        const response = await this.fetchTrendingMusic()

        // Split into quick picks (first 9) and songs list (rest)
        this.quickPicks = response.slice(0, 9).map(this.mapToMusicItem)
        this.songsList = response.slice(9, 30).map(this.mapToMusicItem)
      } catch (error) {
        console.error('Failed to fetch music data:', error)
      } finally {
        this.loadingQuickPicks = false
        this.loadingSongs = false
      }
    },

    async fetchTrendingMusic() {
      // Use local API or fallback to search
      const apiUrl = process.env.IS_ELECTRON
        ? 'https://invidious.snopyta.org/api/v1/trending?type=music'
        : '/api/v1/trending?type=music'

      try {
        const response = await fetch(apiUrl)
        if (!response.ok) throw new Error('API failed')
        return await response.json()
      } catch {
        // Fallback: search for music
        return this.searchMusic('trending music 2024')
      }
    },

    async searchMusic(query) {
      const apiUrl = process.env.IS_ELECTRON
        ? `https://invidious.snopyta.org/api/v1/search?q=${encodeURIComponent(query)}&type=video`
        : `/api/v1/search?q=${encodeURIComponent(query)}`

      const response = await fetch(apiUrl)
      return await response.json()
    },

    mapToMusicItem(video) {
      return {
        id: video.videoId,
        title: video.title,
        thumbnail: video.videoThumbnails?.[4]?.url || video.videoThumbnails?.[0]?.url || '',
        artist: video.author || video.authorId || 'Unknown Artist',
        artistId: video.authorId,
        duration: video.lengthSeconds || 0
      }
    },

    onCategorySelect(categoryId) {
      this.selectedCategory = categoryId
      this.fetchCategoryMusic(categoryId)
    },

    async fetchCategoryMusic(category) {
      this.loadingQuickPicks = true
      this.loadingSongs = true

      const queries = {
        trending: 'trending music 2024',
        chill: 'chill lofi music',
        workout: 'workout gym music',
        focus: 'focus study music',
        party: 'party dance music',
        podcast: 'podcast'
      }

      try {
        const results = await this.searchMusic(queries[category] || category)
        this.quickPicks = results.slice(0, 9).map(this.mapToMusicItem)
        this.songsList = results.slice(9, 30).map(this.mapToMusicItem)
      } catch (error) {
        console.error('Failed to fetch category music:', error)
      } finally {
        this.loadingQuickPicks = false
        this.loadingSongs = false
      }
    },

    playMusic(item) {
      // Navigate to music player or use mini player
      this.$router.push({
        path: `/music/play/${item.id}`
      })
    },

    addToQueue(item) {
      this.addToMusicQueue(item)
    },

    playAllSongs() {
      if (this.songsList.length > 0) {
        // Play first song and queue the rest
        this.playMusic(this.songsList[0])
        this.songsList.slice(1).forEach(song => {
          this.addToQueue(song)
        })
      }
    }
  }
})
