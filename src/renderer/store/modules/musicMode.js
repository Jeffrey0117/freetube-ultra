/**
 * Music Mode Store Module
 * 管理音樂模式的狀態
 */

// Maximum number of cached audio URLs
const MAX_AUDIO_URL_CACHE_SIZE = 10

const state = {
  isMusicMode: false,
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  shuffleEnabled: false,
  repeatMode: 'none', // 'none' | 'one' | 'all'
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1.0,
  // Audio URL cache: { videoId: { url, timestamp } }
  audioUrlCache: {},
  // Track insertion order for LRU eviction (oldest first)
  audioUrlCacheOrder: []
}

const getters = {
  getIsMusicMode: (state) => state.isMusicMode,
  getCurrentTrack: (state) => state.currentTrack,
  getQueue: (state) => state.queue,
  getQueueIndex: (state) => state.queueIndex,
  getShuffleEnabled: (state) => state.shuffleEnabled,
  getRepeatMode: (state) => state.repeatMode,
  getIsPlaying: (state) => state.isPlaying,
  getCurrentTime: (state) => state.currentTime,
  getDuration: (state) => state.duration,
  getVolume: (state) => state.volume,
  getNextTrack: (state) => {
    if (state.queue.length === 0) return null
    const nextIndex = state.queueIndex + 1
    if (nextIndex >= state.queue.length) {
      return state.repeatMode === 'all' ? state.queue[0] : null
    }
    return state.queue[nextIndex]
  },
  getPreviousTrack: (state) => {
    if (state.queue.length === 0) return null
    const prevIndex = state.queueIndex - 1
    if (prevIndex < 0) {
      return state.repeatMode === 'all' ? state.queue[state.queue.length - 1] : null
    }
    return state.queue[prevIndex]
  },
  hasQueue: (state) => state.queue.length > 0,
  // Get cached audio URL for a videoId (returns url or null)
  getCachedAudioUrl: (state) => (videoId) => {
    const cached = state.audioUrlCache[videoId]
    return cached ? cached.url : null
  },
  // Check if a videoId has a cached audio URL
  hasAudioUrlCache: (state) => (videoId) => {
    return !!state.audioUrlCache[videoId]
  }
}

const actions = {
  toggleMusicMode({ commit, state }) {
    commit('SET_MUSIC_MODE', !state.isMusicMode)
    // 儲存到 localStorage
    localStorage.setItem('musicMode', (!state.isMusicMode).toString())
  },

  initMusicMode({ commit }) {
    const saved = localStorage.getItem('musicMode')
    if (saved === 'true') {
      commit('SET_MUSIC_MODE', true)
    }

    // Load saved playback settings from localStorage (use LOAD_ mutations to avoid re-writing)
    const savedVolume = localStorage.getItem('musicMode.volume')
    if (savedVolume !== null) {
      commit('LOAD_VOLUME', parseFloat(savedVolume))
    }

    const savedRepeatMode = localStorage.getItem('musicMode.repeatMode')
    if (savedRepeatMode !== null) {
      commit('LOAD_REPEAT_MODE', savedRepeatMode)
    }

    const savedShuffle = localStorage.getItem('musicMode.shuffle')
    if (savedShuffle !== null) {
      commit('LOAD_SHUFFLE', savedShuffle === 'true')
    }
  },

  playTrack({ commit, state }, track) {
    commit('SET_CURRENT_TRACK', track)
    commit('SET_PLAYING', true)

    // 如果 track 不在 queue 中，加入 queue
    const existingIndex = state.queue.findIndex(t => t.videoId === track.videoId)
    if (existingIndex === -1) {
      commit('ADD_TO_QUEUE', track)
      commit('SET_QUEUE_INDEX', state.queue.length - 1)
    } else {
      commit('SET_QUEUE_INDEX', existingIndex)
    }
  },

  playNext({ commit, state, getters }) {
    if (state.repeatMode === 'one') {
      // 單曲循環：重新播放當前歌曲
      commit('SET_CURRENT_TIME', 0)
      return state.currentTrack
    }

    const nextTrack = getters.getNextTrack
    if (nextTrack) {
      const nextIndex = state.repeatMode === 'all' && state.queueIndex + 1 >= state.queue.length
        ? 0
        : state.queueIndex + 1
      commit('SET_QUEUE_INDEX', nextIndex)
      commit('SET_CURRENT_TRACK', nextTrack)
      return nextTrack
    }

    // 沒有下一首，停止播放
    commit('SET_PLAYING', false)
    return null
  },

  playPrevious({ commit, state, getters }) {
    // 如果播放超過 3 秒，重新播放當前歌曲
    if (state.currentTime > 3) {
      commit('SET_CURRENT_TIME', 0)
      return state.currentTrack
    }

    const prevTrack = getters.getPreviousTrack
    if (prevTrack) {
      const prevIndex = state.queueIndex - 1 < 0
        ? state.queue.length - 1
        : state.queueIndex - 1
      commit('SET_QUEUE_INDEX', prevIndex)
      commit('SET_CURRENT_TRACK', prevTrack)
      return prevTrack
    }

    return null
  },

  addToQueue({ commit }, track) {
    commit('ADD_TO_QUEUE', track)
  },

  removeFromQueue({ commit, state }, index) {
    commit('REMOVE_FROM_QUEUE', index)
    // 調整 queueIndex
    if (index < state.queueIndex) {
      commit('SET_QUEUE_INDEX', state.queueIndex - 1)
    } else if (index === state.queueIndex && state.queue.length > 0) {
      // 移除的是當前播放的歌曲
      const newIndex = Math.min(index, state.queue.length - 1)
      commit('SET_QUEUE_INDEX', newIndex)
      commit('SET_CURRENT_TRACK', state.queue[newIndex])
    }
  },

  clearQueue({ commit }) {
    commit('CLEAR_QUEUE')
    commit('SET_CURRENT_TRACK', null)
    commit('SET_PLAYING', false)
  },

  reorderQueue({ commit, state }, { fromIndex, toIndex }) {
    const newQueue = [...state.queue]
    const [movedItem] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, movedItem)

    commit('SET_QUEUE', newQueue)

    // 更新 queueIndex 以追蹤當前播放的歌曲
    let newQueueIndex = state.queueIndex
    if (fromIndex === state.queueIndex) {
      // 移動的是當前播放的歌曲
      newQueueIndex = toIndex
    } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
      // 從當前播放之前移動到之後
      newQueueIndex = state.queueIndex - 1
    } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
      // 從當前播放之後移動到之前
      newQueueIndex = state.queueIndex + 1
    }

    commit('SET_QUEUE_INDEX', newQueueIndex)
  },

  toggleShuffle({ commit, state }) {
    commit('SET_SHUFFLE', !state.shuffleEnabled)
    if (!state.shuffleEnabled) {
      // 啟用隨機時，打亂 queue（保留當前歌曲位置）
      const currentTrack = state.currentTrack
      const otherTracks = state.queue.filter(t => t.videoId !== currentTrack?.videoId)
      const shuffled = otherTracks.sort(() => Math.random() - 0.5)
      if (currentTrack) {
        commit('SET_QUEUE', [currentTrack, ...shuffled])
        commit('SET_QUEUE_INDEX', 0)
      }
    }
  },

  cycleRepeatMode({ commit, state }) {
    const modes = ['none', 'all', 'one']
    const currentIndex = modes.indexOf(state.repeatMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    commit('SET_REPEAT_MODE', nextMode)
  },

  updateCurrentTime({ commit }, time) {
    commit('SET_CURRENT_TIME', time)
  },

  updateDuration({ commit }, duration) {
    commit('SET_DURATION', duration)
  },

  setPlaying({ commit }, isPlaying) {
    commit('SET_PLAYING', isPlaying)
  },

  setVolume({ commit }, volume) {
    commit('SET_VOLUME', volume)
  },

  togglePlayPause({ commit, state }) {
    commit('SET_PLAYING', !state.isPlaying)
  },

  toggleRepeat({ commit, state }) {
    const modes = ['none', 'all', 'one']
    const currentIndex = modes.indexOf(state.repeatMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    commit('SET_REPEAT_MODE', nextMode)
  },

  setQueue({ commit }, tracks) {
    // 支援直接傳入 array 或 { tracks, startIndex }
    if (Array.isArray(tracks)) {
      commit('SET_QUEUE', tracks)
      if (tracks.length > 0) {
        commit('SET_QUEUE_INDEX', 0)
      }
    } else {
      commit('SET_QUEUE', tracks.tracks)
      commit('SET_QUEUE_INDEX', tracks.startIndex || 0)
      if (tracks.tracks.length > 0) {
        commit('SET_CURRENT_TRACK', tracks.tracks[tracks.startIndex || 0])
      }
    }
  }
}

const mutations = {
  SET_MUSIC_MODE(state, value) {
    state.isMusicMode = value
  },

  SET_CURRENT_TRACK(state, track) {
    state.currentTrack = track
  },

  SET_QUEUE(state, tracks) {
    state.queue = tracks
  },

  SET_QUEUE_INDEX(state, index) {
    state.queueIndex = index
  },

  ADD_TO_QUEUE(state, track) {
    // 避免重複
    if (!state.queue.find(t => t.videoId === track.videoId)) {
      state.queue.push(track)
    }
  },

  REMOVE_FROM_QUEUE(state, index) {
    state.queue.splice(index, 1)
  },

  CLEAR_QUEUE(state) {
    state.queue = []
    state.queueIndex = 0
  },

  SET_SHUFFLE(state, value) {
    state.shuffleEnabled = value
    localStorage.setItem('musicMode.shuffle', value.toString())
  },

  // Load shuffle from localStorage without re-writing
  LOAD_SHUFFLE(state, value) {
    state.shuffleEnabled = value
  },

  SET_REPEAT_MODE(state, mode) {
    state.repeatMode = mode
    localStorage.setItem('musicMode.repeatMode', mode)
  },

  // Load repeat mode from localStorage without re-writing
  LOAD_REPEAT_MODE(state, mode) {
    state.repeatMode = mode
  },

  SET_PLAYING(state, value) {
    state.isPlaying = value
  },

  SET_CURRENT_TIME(state, time) {
    state.currentTime = time
  },

  SET_DURATION(state, duration) {
    state.duration = duration
  },

  SET_VOLUME(state, volume) {
    state.volume = volume
    localStorage.setItem('musicMode.volume', volume.toString())
  },

  // Load volume from localStorage without re-writing
  LOAD_VOLUME(state, volume) {
    state.volume = volume
  },

  // Cache an audio URL for a videoId
  SET_AUDIO_URL_CACHE(state, { videoId, url }) {
    // If already cached, update and move to end of order
    if (state.audioUrlCache[videoId]) {
      state.audioUrlCache[videoId] = { url, timestamp: Date.now() }
      const idx = state.audioUrlCacheOrder.indexOf(videoId)
      if (idx > -1) {
        state.audioUrlCacheOrder.splice(idx, 1)
      }
      state.audioUrlCacheOrder.push(videoId)
      return
    }

    // If cache is full, remove oldest entry
    if (state.audioUrlCacheOrder.length >= MAX_AUDIO_URL_CACHE_SIZE) {
      const oldestId = state.audioUrlCacheOrder.shift()
      delete state.audioUrlCache[oldestId]
      console.log('[MusicMode] Cache full, evicted oldest:', oldestId)
    }

    // Add new entry
    state.audioUrlCache[videoId] = { url, timestamp: Date.now() }
    state.audioUrlCacheOrder.push(videoId)
    console.log('[MusicMode] Cached audio URL for:', videoId, 'Cache size:', state.audioUrlCacheOrder.length)
  },

  // Clear a specific entry from cache
  CLEAR_AUDIO_URL_CACHE_ENTRY(state, videoId) {
    if (state.audioUrlCache[videoId]) {
      delete state.audioUrlCache[videoId]
      const idx = state.audioUrlCacheOrder.indexOf(videoId)
      if (idx > -1) {
        state.audioUrlCacheOrder.splice(idx, 1)
      }
    }
  },

  // Clear all cached audio URLs
  CLEAR_AUDIO_URL_CACHE(state) {
    state.audioUrlCache = {}
    state.audioUrlCacheOrder = []
    console.log('[MusicMode] Audio URL cache cleared')
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
