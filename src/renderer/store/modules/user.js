/**
 * 會員系統 Vuex 模組
 * 處理用戶認證、資料管理和會話狀態
 */

import { DBUserHandlers } from '../../../datastores/handlers/index'

// 簡易密碼雜湊函式（使用 Web Crypto API）
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 驗證密碼
async function verifyPassword(password, hash) {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

// 產生唯一 ID
function generateUserId() {
  return 'user-' + crypto.randomUUID()
}

// 產生會話 Token
function generateSessionToken() {
  return crypto.randomUUID()
}

// 預設用戶統計數據
function getDefaultStats() {
  return {
    totalWatchTime: 0,
    videosWatched: 0,
    subscriptionCount: 0,
    playlistCount: 0
  }
}

// 會話有效期（7 天）
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000

const state = {
  // 當前登入用戶
  currentUser: null,
  // 是否已認證
  isAuthenticated: false,
  // 載入狀態
  isLoading: false,
  // 本地所有用戶列表
  localUsers: [],
  // 會話資訊
  session: {
    token: null,
    expiresAt: null
  }
}

const getters = {
  /**
   * 載入狀態
   */
  isLoading: (state) => state.isLoading,

  /**
   * 是否已登入
   */
  isLoggedIn: (state) => {
    return state.isAuthenticated && state.currentUser !== null
  },

  /**
   * 當前用戶（完整資料）
   */
  currentUser: (state) => {
    return state.currentUser ?? {
      _id: null,
      username: 'guest',
      displayName: '',
      avatar: '',
      createdAt: null,
      stats: getDefaultStats(),
      preferences: {}
    }
  },

  /**
   * 當前用戶 ID
   */
  currentUserId: (state) => {
    return state.currentUser?._id ?? null
  },

  /**
   * 當前用戶名
   */
  currentUsername: (state) => {
    return state.currentUser?.username ?? null
  },

  /**
   * 當前用戶頭像
   */
  currentUserAvatar: (state) => {
    return state.currentUser?.avatar ?? 'default'
  },

  /**
   * 當前用戶偏好設定
   */
  userPreferences: (state) => {
    return state.currentUser?.preferences ?? {}
  },

  /**
   * 當前用戶顯示名稱
   */
  currentDisplayName: (state) => {
    return state.currentUser?.displayName ?? state.currentUser?.username ?? null
  },

  /**
   * 當前用戶統計數據
   */
  currentUserStats: (state) => {
    return state.currentUser?.stats ?? getDefaultStats()
  },

  /**
   * 取得所有本地用戶
   */
  getLocalUsers: (state) => {
    return state.localUsers
  },

  /**
   * 取得所有本地用戶（別名，用於 ft-user-menu 元件）
   */
  localUsers: (state) => {
    return state.localUsers
  },

  /**
   * 會話是否有效
   */
  isSessionValid: (state) => {
    if (!state.session.token || !state.session.expiresAt) {
      return false
    }
    return Date.now() < state.session.expiresAt
  },

  /**
   * 是否啟用同步（暫時返回 false，未來實作）
   */
  syncEnabled: () => false,

  /**
   * 是否正在同步
   */
  isSyncing: () => false,

  /**
   * 是否有同步錯誤
   */
  hasSyncError: () => false
}

const actions = {
  /**
   * 應用啟動時初始化用戶系統
   * 嘗試從本地儲存恢復會話
   */
  async initializeUser({ commit, dispatch }) {
    commit('SET_LOADING', true)

    try {
      // 載入所有本地用戶
      await dispatch('loadLocalUsers')

      // 嘗試從 localStorage 恢復會話
      const savedSession = localStorage.getItem('userSession')
      if (savedSession) {
        const session = JSON.parse(savedSession)

        // 檢查會話是否過期
        if (session.expiresAt && Date.now() < session.expiresAt) {
          // 嘗試載入用戶
          const user = await DBUserHandlers.findById(session.userId)
          if (user) {
            commit('SET_USER', user)
            commit('SET_AUTHENTICATED', true)
            commit('SET_SESSION', {
              token: session.token,
              expiresAt: session.expiresAt
            })

            // 更新最後登入時間
            await DBUserHandlers.updateLastLogin(user._id)
          } else {
            // 用戶不存在，清除會話
            localStorage.removeItem('userSession')
          }
        } else {
          // 會話過期，清除
          localStorage.removeItem('userSession')
        }
      }
    } catch (error) {
      console.error('初始化用戶系統失敗:', error)
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 載入所有本地用戶
   */
  async loadLocalUsers({ commit }) {
    try {
      const users = await DBUserHandlers.find()
      // 移除敏感資訊後儲存到 state
      const safeUsers = users.map(user => ({
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }))
      commit('SET_LOCAL_USERS', safeUsers)
    } catch (error) {
      console.error('載入本地用戶失敗:', error)
      commit('SET_LOCAL_USERS', [])
    }
  },

  /**
   * 用戶註冊
   * @param {Object} payload - 註冊資訊
   * @param {string} payload.username - 用戶名（3-20 字元）
   * @param {string} payload.password - 密碼
   * @param {string} payload.displayName - 顯示名稱（可選）
   * @param {string} payload.avatar - 頭像（可選）
   */
  async register({ commit, dispatch }, { username, password, displayName = '', avatar = 'default' }) {
    commit('SET_LOADING', true)

    try {
      // 驗證用戶名格式
      const trimmedUsername = username.trim().toLowerCase()
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        throw new Error('用戶名長度必須在 3-20 字元之間')
      }

      // 檢查用戶名是否僅包含允許的字元
      if (!/^[a-z0-9_-]+$/.test(trimmedUsername)) {
        throw new Error('用戶名只能包含小寫英文字母、數字、底線和連字號')
      }

      // 檢查用戶名是否已存在
      const existingUser = await DBUserHandlers.findByUsername(trimmedUsername)
      if (existingUser) {
        throw new Error('用戶名已被使用')
      }

      // 驗證密碼強度
      if (password.length < 4) {
        throw new Error('密碼長度至少需要 4 個字元')
      }

      // 建立新用戶
      const now = Date.now()
      const passwordHash = await hashPassword(password)

      const newUser = {
        _id: generateUserId(),
        username: trimmedUsername,
        displayName: displayName.trim() || trimmedUsername,
        passwordHash,
        avatar,
        createdAt: now,
        lastLoginAt: now,
        stats: getDefaultStats(),
        preferences: {}
      }

      // 儲存到資料庫
      await DBUserHandlers.create(newUser)

      // 建立會話
      const session = {
        token: generateSessionToken(),
        expiresAt: now + SESSION_DURATION
      }

      // 儲存會話到 localStorage
      localStorage.setItem('userSession', JSON.stringify({
        userId: newUser._id,
        token: session.token,
        expiresAt: session.expiresAt
      }))

      // 更新狀態
      commit('SET_USER', newUser)
      commit('SET_AUTHENTICATED', true)
      commit('SET_SESSION', session)

      // 重新載入用戶列表
      await dispatch('loadLocalUsers')

      return { success: true, user: newUser }
    } catch (error) {
      console.error('註冊失敗:', error)
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 用戶登入
   * @param {Object} payload - 登入資訊
   * @param {string} payload.username - 用戶名
   * @param {string} payload.password - 密碼
   */
  async login({ commit, dispatch }, { username, password }) {
    commit('SET_LOADING', true)

    try {
      // 查詢用戶
      const user = await DBUserHandlers.findByUsername(username.trim().toLowerCase())
      if (!user) {
        throw new Error('用戶名或密碼錯誤')
      }

      // 驗證密碼
      const isValid = await verifyPassword(password, user.passwordHash)
      if (!isValid) {
        throw new Error('用戶名或密碼錯誤')
      }

      // 建立會話
      const now = Date.now()
      const session = {
        token: generateSessionToken(),
        expiresAt: now + SESSION_DURATION
      }

      // 儲存會話到 localStorage
      localStorage.setItem('userSession', JSON.stringify({
        userId: user._id,
        token: session.token,
        expiresAt: session.expiresAt
      }))

      // 更新最後登入時間
      await DBUserHandlers.updateLastLogin(user._id)
      user.lastLoginAt = now

      // 更新狀態
      commit('SET_USER', user)
      commit('SET_AUTHENTICATED', true)
      commit('SET_SESSION', session)

      // 重新載入用戶列表以更新最後登入時間
      await dispatch('loadLocalUsers')

      return { success: true, user }
    } catch (error) {
      console.error('登入失敗:', error)
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 用戶登出
   */
  async logout({ commit }) {
    // 清除 localStorage 會話
    localStorage.removeItem('userSession')

    // 清除狀態
    commit('SET_USER', null)
    commit('SET_AUTHENTICATED', false)
    commit('SET_SESSION', { token: null, expiresAt: null })

    return { success: true }
  },

  /**
   * 切換用戶（需要重新登入）
   * @param {string} userId - 目標用戶 ID
   */
  async switchUser({ dispatch }, userId) {
    // 先登出當前用戶
    await dispatch('logout')

    // 返回需要登入的用戶資訊
    const users = await DBUserHandlers.find()
    const targetUser = users.find(u => u._id === userId)

    if (targetUser) {
      return {
        success: true,
        needsLogin: true,
        user: {
          _id: targetUser._id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          avatar: targetUser.avatar
        }
      }
    }

    return { success: false, error: '找不到該用戶' }
  },

  /**
   * 更新用戶個人檔案
   * @param {Object} payload - 更新資訊
   * @param {string} payload.displayName - 顯示名稱（可選）
   * @param {string} payload.avatar - 頭像（可選）
   * @param {string} payload.newPassword - 新密碼（可選）
   * @param {string} payload.currentPassword - 當前密碼（更改密碼時必填）
   * @param {Object} payload.preferences - 偏好設定（可選）
   */
  async updateProfile({ commit, state }, payload) {
    if (!state.currentUser) {
      return { success: false, error: '未登入' }
    }

    commit('SET_LOADING', true)

    try {
      const updates = { ...state.currentUser }

      // 更新顯示名稱
      if (payload.displayName !== undefined) {
        updates.displayName = payload.displayName.trim() || state.currentUser.username
      }

      // 更新頭像
      if (payload.avatar !== undefined) {
        updates.avatar = payload.avatar
      }

      // 更新密碼
      if (payload.newPassword) {
        if (!payload.currentPassword) {
          throw new Error('請輸入當前密碼')
        }

        const isValid = await verifyPassword(payload.currentPassword, state.currentUser.passwordHash)
        if (!isValid) {
          throw new Error('當前密碼錯誤')
        }

        if (payload.newPassword.length < 4) {
          throw new Error('新密碼長度至少需要 4 個字元')
        }

        updates.passwordHash = await hashPassword(payload.newPassword)
      }

      // 更新偏好設定
      if (payload.preferences !== undefined) {
        updates.preferences = {
          ...state.currentUser.preferences,
          ...payload.preferences
        }
      }

      // 儲存到資料庫
      await DBUserHandlers.upsert(updates)

      // 更新狀態
      commit('SET_USER', updates)

      return { success: true, user: updates }
    } catch (error) {
      console.error('更新個人檔案失敗:', error)
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 刪除帳戶
   * @param {string} password - 確認密碼
   */
  async deleteAccount({ commit, state, dispatch }, password) {
    if (!state.currentUser) {
      return { success: false, error: '未登入' }
    }

    commit('SET_LOADING', true)

    try {
      // 驗證密碼
      const isValid = await verifyPassword(password, state.currentUser.passwordHash)
      if (!isValid) {
        throw new Error('密碼錯誤')
      }

      // 從資料庫刪除用戶
      await DBUserHandlers.delete(state.currentUser._id)

      // 登出
      await dispatch('logout')

      // 重新載入用戶列表
      await dispatch('loadLocalUsers')

      return { success: true }
    } catch (error) {
      console.error('刪除帳戶失敗:', error)
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 更新用戶統計數據
   * @param {Object} stats - 統計數據更新
   */
  async updateUserStats({ commit, state }, stats) {
    if (!state.currentUser) {
      return { success: false, error: '未登入' }
    }

    try {
      // 更新資料庫
      await DBUserHandlers.updateStats(state.currentUser._id, stats)

      // 更新狀態
      commit('UPDATE_USER_STATS', stats)

      return { success: true }
    } catch (error) {
      console.error('更新統計數據失敗:', error)
      return { success: false, error: error.message }
    }
  }
}

const mutations = {
  /**
   * 設定當前用戶
   */
  SET_USER(state, user) {
    state.currentUser = user
  },

  /**
   * 設定認證狀態
   */
  SET_AUTHENTICATED(state, isAuthenticated) {
    state.isAuthenticated = isAuthenticated
  },

  /**
   * 設定載入狀態
   */
  SET_LOADING(state, isLoading) {
    state.isLoading = isLoading
  },

  /**
   * 設定本地用戶列表
   */
  SET_LOCAL_USERS(state, users) {
    state.localUsers = users
  },

  /**
   * 設定會話資訊
   */
  SET_SESSION(state, session) {
    state.session = session
  },

  /**
   * 更新用戶統計數據
   */
  UPDATE_USER_STATS(state, stats) {
    if (state.currentUser) {
      state.currentUser.stats = {
        ...state.currentUser.stats,
        ...stats
      }
    }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
