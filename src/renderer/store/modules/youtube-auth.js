/**
 * YouTube Cookie 認證 Vuex 模組
 * 處理 YouTube Cookie 的設定、驗證和狀態管理
 */

import {
  setYouTubeCookie,
  removeYouTubeCookie,
  getStoredYouTubeCookie,
  getAuthStatus,
  validateYouTubeCookie,
  hasStoredCookie
} from '../../helpers/youtube-cookie'

const state = {
  // 是否啟用 YouTube Cookie 認證
  isEnabled: false,
  // 是否已連接（Cookie 有效）
  isConnected: false,
  // YouTube 帳戶名稱
  accountName: null,
  // 最後驗證時間
  lastValidated: null,
  // 是否正在驗證中
  isValidating: false,
  // 錯誤訊息
  error: null
}

const getters = {
  /**
   * 是否啟用 YouTube Cookie 認證
   */
  isYouTubeAuthEnabled: (state) => state.isEnabled,

  /**
   * 是否已連接 YouTube
   */
  isYouTubeConnected: (state) => state.isConnected,

  /**
   * YouTube 帳戶名稱
   */
  youtubeAccountName: (state) => state.accountName,

  /**
   * 是否正在驗證中
   */
  isValidating: (state) => state.isValidating,

  /**
   * 錯誤訊息
   */
  authError: (state) => state.error,

  /**
   * 最後驗證時間
   */
  lastValidated: (state) => state.lastValidated,

  /**
   * 連線狀態文字
   */
  connectionStatus: (state) => {
    if (state.isValidating) return 'validating'
    if (state.isConnected) return 'connected'
    if (state.isEnabled && !state.isConnected) return 'disconnected'
    return 'disabled'
  }
}

const actions = {
  /**
   * 初始化 YouTube 認證狀態
   * 從 localStorage 或環境變數恢復狀態
   */
  async initializeYouTubeAuth({ commit }) {
    try {
      // 檢查是否有環境變數中的 cookie
      const hasEnvCookie = !!process.env.YOUTUBE_COOKIE

      // 從 localStorage 讀取認證狀態
      const authStatus = getAuthStatus()

      if (authStatus) {
        commit('SET_AUTH_STATUS', authStatus)

        // 如果有儲存的 cookie，嘗試驗證是否仍然有效
        if (authStatus.isEnabled && hasStoredCookie()) {
          // 不阻塞初始化，背景驗證
          // 暫時假設有效，之後再驗證
          commit('SET_CONNECTED', true)
        }
      } else if (hasEnvCookie) {
        // 有環境變數中的 cookie，自動啟用
        console.log('YouTube Cookie found in environment variable, auto-enabling...')
        commit('SET_AUTH_STATUS', {
          isEnabled: true,
          isConnected: true,
          accountName: '(環境變數)',
          lastValidated: Date.now()
        })
      }
    } catch (error) {
      console.error('初始化 YouTube 認證狀態失敗:', error)
    }
  },

  /**
   * 設定 YouTube Cookie
   * @param {string} cookie - Cookie 字串
   */
  async setYouTubeCookie({ commit }, cookie) {
    commit('SET_VALIDATING', true)
    commit('SET_ERROR', null)

    try {
      const result = await setYouTubeCookie(cookie)

      if (result.success) {
        commit('SET_AUTH_STATUS', {
          isEnabled: true,
          isConnected: true,
          accountName: result.accountName,
          lastValidated: Date.now()
        })

        return { success: true, accountName: result.accountName }
      } else {
        commit('SET_ERROR', result.error)
        return { success: false, error: result.error }
      }
    } catch (error) {
      const errorMessage = error.message || 'Cookie 設定失敗'
      commit('SET_ERROR', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      commit('SET_VALIDATING', false)
    }
  },

  /**
   * 清除 YouTube Cookie
   */
  async clearYouTubeCookie({ commit }) {
    try {
      removeYouTubeCookie()

      commit('SET_AUTH_STATUS', {
        isEnabled: false,
        isConnected: false,
        accountName: null,
        lastValidated: null
      })
      commit('SET_ERROR', null)

      return { success: true }
    } catch (error) {
      console.error('清除 Cookie 失敗:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * 重新驗證已儲存的 Cookie
   */
  async revalidateCookie({ commit, state }) {
    if (!state.isEnabled) {
      return { success: false, error: '未啟用 YouTube 認證' }
    }

    commit('SET_VALIDATING', true)
    commit('SET_ERROR', null)

    try {
      const cookie = await getStoredYouTubeCookie()

      if (!cookie) {
        commit('SET_CONNECTED', false)
        commit('SET_ERROR', '找不到已儲存的 Cookie')
        return { success: false, error: '找不到已儲存的 Cookie' }
      }

      const validation = await validateYouTubeCookie(cookie)

      if (validation.valid) {
        commit('SET_AUTH_STATUS', {
          isEnabled: true,
          isConnected: true,
          accountName: validation.accountName,
          lastValidated: Date.now()
        })

        return { success: true, accountName: validation.accountName }
      } else {
        commit('SET_CONNECTED', false)
        commit('SET_ERROR', validation.error || 'Cookie 已失效')
        return { success: false, error: validation.error || 'Cookie 已失效' }
      }
    } catch (error) {
      const errorMessage = error.message || '驗證失敗'
      commit('SET_CONNECTED', false)
      commit('SET_ERROR', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      commit('SET_VALIDATING', false)
    }
  },

  /**
   * 切換 YouTube Cookie 認證啟用狀態
   */
  async toggleYouTubeAuth({ commit, state, dispatch }) {
    if (state.isEnabled) {
      // 停用
      return await dispatch('clearYouTubeCookie')
    } else {
      // 需要設定 Cookie
      return { success: false, needsCookie: true }
    }
  }
}

const mutations = {
  /**
   * 設定完整認證狀態
   */
  SET_AUTH_STATUS(state, { isEnabled, isConnected, accountName, lastValidated }) {
    if (isEnabled !== undefined) state.isEnabled = isEnabled
    if (isConnected !== undefined) state.isConnected = isConnected
    if (accountName !== undefined) state.accountName = accountName
    if (lastValidated !== undefined) state.lastValidated = lastValidated
  },

  /**
   * 設定連接狀態
   */
  SET_CONNECTED(state, isConnected) {
    state.isConnected = isConnected
  },

  /**
   * 設定驗證中狀態
   */
  SET_VALIDATING(state, isValidating) {
    state.isValidating = isValidating
  },

  /**
   * 設定錯誤訊息
   */
  SET_ERROR(state, error) {
    state.error = error
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
