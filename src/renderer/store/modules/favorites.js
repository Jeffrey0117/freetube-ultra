/**
 * Favorites Store Module
 * 管理收藏影片功能
 */

const STORAGE_KEY = 'yt-favorites'

// 從 localStorage 讀取
function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('[Favorites] Failed to load from storage:', e)
    return []
  }
}

// 儲存到 localStorage
function saveToStorage(favorites) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  } catch (e) {
    console.error('[Favorites] Failed to save to storage:', e)
  }
}

const state = {
  favorites: loadFromStorage()
}

const getters = {
  getFavorites: (state) => state.favorites,

  isFavorite: (state) => (videoId) => {
    return state.favorites.some(f => f.videoId === videoId)
  },

  getFavoriteCount: (state) => state.favorites.length
}

const actions = {
  addFavorite({ commit, state }, video) {
    // 檢查是否已收藏
    if (state.favorites.some(f => f.videoId === video.videoId)) {
      console.log('[Favorites] Already favorited:', video.videoId)
      return false
    }

    const favorite = {
      videoId: video.videoId,
      title: video.title,
      author: video.author,
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
      duration: video.duration || video.lengthSeconds || 0,
      addedAt: Date.now()
    }

    commit('ADD_FAVORITE', favorite)
    saveToStorage(state.favorites)
    console.log('[Favorites] Added:', video.videoId)
    return true
  },

  removeFavorite({ commit, state }, videoId) {
    commit('REMOVE_FAVORITE', videoId)
    saveToStorage(state.favorites)
    console.log('[Favorites] Removed:', videoId)
  },

  toggleFavorite({ dispatch, getters }, video) {
    if (getters.isFavorite(video.videoId)) {
      dispatch('removeFavorite', video.videoId)
      return false
    } else {
      dispatch('addFavorite', video)
      return true
    }
  },

  clearAllFavorites({ commit }) {
    commit('CLEAR_FAVORITES')
    saveToStorage([])
    console.log('[Favorites] Cleared all')
  }
}

const mutations = {
  ADD_FAVORITE(state, favorite) {
    state.favorites.unshift(favorite) // 新的在前面
  },

  REMOVE_FAVORITE(state, videoId) {
    state.favorites = state.favorites.filter(f => f.videoId !== videoId)
  },

  CLEAR_FAVORITES(state) {
    state.favorites = []
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
