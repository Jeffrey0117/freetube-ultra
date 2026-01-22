/**
 * Subscriptions Store Module
 * 管理頻道訂閱功能（頻道收藏）
 */

const STORAGE_KEY = 'yt-subscribed-channels'

// 從 localStorage 讀取
function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('[Subscriptions] Failed to load from storage:', e)
    return []
  }
}

// 儲存到 localStorage
function saveToStorage(channels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels))
  } catch (e) {
    console.error('[Subscriptions] Failed to save to storage:', e)
  }
}

const state = {
  subscribedChannels: loadFromStorage(),
  feedVideos: [],
  isLoadingFeed: false,
  feedFilter: 'all' // '7days' | '30days' | 'all'
}

const getters = {
  getSubscribedChannels: (state) => state.subscribedChannels,

  isSubscribed: (state) => (channelId) => {
    return state.subscribedChannels.some(c => c.channelId === channelId)
  },

  getSubscriptionCount: (state) => state.subscribedChannels.length,

  getFeedVideos: (state) => state.feedVideos,

  getFilteredFeedVideos: (state) => {
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    switch (state.feedFilter) {
      case '7days':
        return state.feedVideos.filter(v => now - v.published < 7 * oneDay)
      case '30days':
        return state.feedVideos.filter(v => now - v.published < 30 * oneDay)
      case 'all':
      default:
        return state.feedVideos
    }
  },

  isLoadingFeed: (state) => state.isLoadingFeed,

  getFeedFilter: (state) => state.feedFilter
}

const actions = {
  subscribeChannel({ commit, state }, channel) {
    // 檢查是否已訂閱
    if (state.subscribedChannels.some(c => c.channelId === channel.channelId)) {
      console.log('[Subscriptions] Already subscribed:', channel.channelId)
      return false
    }

    const subscription = {
      channelId: channel.channelId,
      name: channel.name || channel.author,
      thumbnail: channel.thumbnail || channel.authorThumbnail,
      subscriberCount: channel.subscriberCount || 0,
      videoCount: channel.videoCount || 0,
      subscribedAt: Date.now()
    }

    commit('ADD_SUBSCRIPTION', subscription)
    saveToStorage(state.subscribedChannels)
    console.log('[Subscriptions] Subscribed to:', channel.name)
    return true
  },

  unsubscribeChannel({ commit, state }, channelId) {
    commit('REMOVE_SUBSCRIPTION', channelId)
    saveToStorage(state.subscribedChannels)
    console.log('[Subscriptions] Unsubscribed from:', channelId)
  },

  toggleSubscription({ dispatch, getters }, channel) {
    if (getters.isSubscribed(channel.channelId)) {
      dispatch('unsubscribeChannel', channel.channelId)
      return false
    } else {
      dispatch('subscribeChannel', channel)
      return true
    }
  },

  async loadSubscriptionFeed({ commit, state }) {
    if (state.subscribedChannels.length === 0) {
      commit('SET_FEED_VIDEOS', [])
      return
    }

    commit('SET_LOADING_FEED', true)

    try {
      const allVideos = []

      // 並行取得所有頻道的影片
      const promises = state.subscribedChannels.map(async (channel) => {
        try {
          const response = await fetch(`/api/v1/channels/${channel.channelId}/videos?sortBy=newest`)
          if (response.ok) {
            const data = await response.json()
            // API 可能直接回傳陣列，或是 { videos: [] }
            const videos = Array.isArray(data) ? data : (data?.videos || [])
            console.log('[Subscriptions] Channel', channel.name, 'videos:', videos.length)
            // 取最新 10 部影片
            return videos.slice(0, 10).map(v => ({
              videoId: v.videoId,
              title: v.title,
              author: channel.name,
              authorId: channel.channelId,
              authorThumbnail: channel.thumbnail,
              thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
              duration: v.lengthSeconds || 0,
              viewCount: v.viewCount || 0,
              published: v.published || Date.now(),
              publishedText: v.publishedText || ''
            }))
          }
          return []
        } catch (e) {
          console.error('[Subscriptions] Failed to fetch videos for channel:', channel.channelId, e)
          return []
        }
      })

      const results = await Promise.all(promises)
      results.forEach(videos => allVideos.push(...videos))

      // 按發布時間排序，最新在前
      allVideos.sort((a, b) => b.published - a.published)

      commit('SET_FEED_VIDEOS', allVideos)
      console.log('[Subscriptions] Loaded', allVideos.length, 'videos from', state.subscribedChannels.length, 'channels')
    } catch (e) {
      console.error('[Subscriptions] Failed to load feed:', e)
    }

    commit('SET_LOADING_FEED', false)
  },

  setFeedFilter({ commit }, filter) {
    commit('SET_FEED_FILTER', filter)
  },

  clearAllSubscriptions({ commit }) {
    commit('CLEAR_SUBSCRIPTIONS')
    commit('SET_FEED_VIDEOS', [])
    saveToStorage([])
    console.log('[Subscriptions] Cleared all subscriptions')
  }
}

const mutations = {
  ADD_SUBSCRIPTION(state, channel) {
    state.subscribedChannels.unshift(channel)
  },

  REMOVE_SUBSCRIPTION(state, channelId) {
    state.subscribedChannels = state.subscribedChannels.filter(c => c.channelId !== channelId)
  },

  CLEAR_SUBSCRIPTIONS(state) {
    state.subscribedChannels = []
  },

  SET_FEED_VIDEOS(state, videos) {
    state.feedVideos = videos
  },

  SET_LOADING_FEED(state, value) {
    state.isLoadingFeed = value
  },

  SET_FEED_FILTER(state, filter) {
    state.feedFilter = filter
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
