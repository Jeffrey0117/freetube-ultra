/**
 * Music Mode Store Module
 * 管理音樂模式的狀態
 */

const state = {
  isMusicMode: false,
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  shuffleEnabled: false,
  repeatMode: 'none', // 'none' | 'one' | 'all'
  isPlaying: false,
  currentTime: 0,
  duration: 0
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
  hasQueue: (state) => state.queue.length > 0
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

  setQueue({ commit }, { tracks, startIndex = 0 }) {
    commit('SET_QUEUE', tracks)
    commit('SET_QUEUE_INDEX', startIndex)
    if (tracks.length > 0) {
      commit('SET_CURRENT_TRACK', tracks[startIndex])
    }
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
  },

  SET_REPEAT_MODE(state, mode) {
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
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
