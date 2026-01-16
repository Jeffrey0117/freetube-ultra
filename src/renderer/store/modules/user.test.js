/**
 * User Vuex 模組單元測試
 * 測試會員系統的所有功能：state、getters、mutations、actions
 *
 * 執行方式：node src/renderer/store/modules/user.test.js
 */

// ============================================================================
// Mock 設置
// ============================================================================

// Mock localStorage
const mockLocalStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null
  },
  setItem(key, value) {
    this.store[key] = String(value)
  },
  removeItem(key) {
    delete this.store[key]
  },
  clear() {
    this.store = {}
  }
}

// 設置全域 localStorage mock
global.localStorage = mockLocalStorage

// Mock crypto API
global.crypto = {
  subtle: {
    async digest(algorithm, data) {
      // 簡易模擬 SHA-256 雜湊
      let hash = 0
      const dataArray = new Uint8Array(data)
      for (let i = 0; i < dataArray.length; i++) {
        hash = ((hash << 5) - hash) + dataArray[i]
        hash = hash & hash
      }
      // 返回 32 bytes 的 ArrayBuffer
      const buffer = new ArrayBuffer(32)
      const view = new DataView(buffer)
      for (let i = 0; i < 8; i++) {
        view.setUint32(i * 4, Math.abs(hash + i * 1000))
      }
      return buffer
    }
  },
  randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

// Mock TextEncoder
global.TextEncoder = class TextEncoder {
  encode(str) {
    const arr = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i)
    }
    return arr
  }
}

// Mock DBUserHandlers - 每個測試都會重置
let mockDBUsers = []
const mockDBUserHandlers = {
  async find() {
    return [...mockDBUsers]
  },
  async findById(id) {
    return mockDBUsers.find(u => u._id === id) || null
  },
  async findByUsername(username) {
    return mockDBUsers.find(u => u.username === username) || null
  },
  async create(user) {
    mockDBUsers.push({ ...user })
    return user
  },
  async upsert(user) {
    const index = mockDBUsers.findIndex(u => u._id === user._id)
    if (index >= 0) {
      mockDBUsers[index] = { ...user }
    } else {
      mockDBUsers.push({ ...user })
    }
    return user
  },
  async delete(id) {
    mockDBUsers = mockDBUsers.filter(u => u._id !== id)
    return true
  },
  async updateLastLogin(id) {
    const user = mockDBUsers.find(u => u._id === id)
    if (user) {
      user.lastLoginAt = Date.now()
    }
    return true
  },
  async updateStats(id, stats) {
    const user = mockDBUsers.find(u => u._id === id)
    if (user) {
      user.stats = { ...user.stats, ...stats }
    }
    return true
  }
}

// 重置 mock 資料
function resetMocks() {
  mockDBUsers = []
  mockLocalStorage.clear()
}

// ============================================================================
// 簡易測試框架
// ============================================================================

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: []
}

let currentDescribe = ''

function describe(name, fn) {
  currentDescribe = name
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${name}`)
  console.log('='.repeat(60))
  return fn
}

async function test(name, fn) {
  testResults.total++
  const fullName = `${currentDescribe} > ${name}`
  try {
    await fn()
    testResults.passed++
    testResults.tests.push({ name: fullName, passed: true })
    console.log(`  [PASS] ${name}`)
  } catch (error) {
    testResults.failed++
    testResults.tests.push({ name: fullName, passed: false, error: error.message })
    console.log(`  [FAIL] ${name}`)
    console.log(`         ${error.message}`)
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`期望 ${JSON.stringify(expected)}，但得到 ${JSON.stringify(actual)}`)
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`期望 null，但得到 ${JSON.stringify(actual)}`)
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`期望 truthy，但得到 ${JSON.stringify(actual)}`)
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`期望 falsy，但得到 ${JSON.stringify(actual)}`)
      }
    },
    toEqual(expected) {
      const actualStr = JSON.stringify(actual)
      const expectedStr = JSON.stringify(expected)
      if (actualStr !== expectedStr) {
        throw new Error(`期望 ${expectedStr}，但得到 ${actualStr}`)
      }
    },
    toContain(item) {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(`期望陣列包含 ${JSON.stringify(item)}`)
      }
    },
    toHaveLength(length) {
      if (!Array.isArray(actual) || actual.length !== length) {
        throw new Error(`期望長度為 ${length}，但得到 ${actual?.length}`)
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`期望 ${actual} > ${expected}`)
      }
    },
    toBeLessThan(expected) {
      if (actual >= expected) {
        throw new Error(`期望 ${actual} < ${expected}`)
      }
    },
    toHaveProperty(prop) {
      if (actual === null || actual === undefined || !(prop in actual)) {
        throw new Error(`期望物件有屬性 ${prop}`)
      }
    }
  }
}

// ============================================================================
// 輔助函式：模擬密碼雜湊
// ============================================================================

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================================
// 建立測試用的 Store 模組
// ============================================================================

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

// 建立初始 state
function createState() {
  return {
    currentUser: null,
    isAuthenticated: false,
    isLoading: false,
    localUsers: [],
    session: {
      token: null,
      expiresAt: null
    }
  }
}

// Getters
const getters = {
  isLoggedIn: (state) => {
    return state.isAuthenticated && state.currentUser !== null
  },
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
  currentUserId: (state) => {
    return state.currentUser?._id ?? null
  },
  currentUsername: (state) => {
    return state.currentUser?.username ?? null
  },
  currentUserAvatar: (state) => {
    return state.currentUser?.avatar ?? 'default'
  },
  userPreferences: (state) => {
    return state.currentUser?.preferences ?? {}
  },
  currentDisplayName: (state) => {
    return state.currentUser?.displayName ?? state.currentUser?.username ?? null
  },
  currentUserStats: (state) => {
    return state.currentUser?.stats ?? getDefaultStats()
  },
  getLocalUsers: (state) => {
    return state.localUsers
  },
  localUsers: (state) => {
    return state.localUsers
  },
  isSessionValid: (state) => {
    if (!state.session.token || !state.session.expiresAt) {
      return false
    }
    return Date.now() < state.session.expiresAt
  },
  syncEnabled: () => false,
  isSyncing: () => false,
  hasSyncError: () => false
}

// Mutations
const mutations = {
  SET_USER(state, user) {
    state.currentUser = user
  },
  SET_AUTHENTICATED(state, isAuthenticated) {
    state.isAuthenticated = isAuthenticated
  },
  SET_LOADING(state, isLoading) {
    state.isLoading = isLoading
  },
  SET_LOCAL_USERS(state, users) {
    state.localUsers = users
  },
  SET_SESSION(state, session) {
    state.session = session
  },
  UPDATE_USER_STATS(state, stats) {
    if (state.currentUser) {
      state.currentUser.stats = {
        ...state.currentUser.stats,
        ...stats
      }
    }
  }
}

// Actions（使用 mock 的 DBUserHandlers）
const actions = {
  async initializeUser({ commit, dispatch }) {
    commit('SET_LOADING', true)
    try {
      await dispatch('loadLocalUsers')
      const savedSession = localStorage.getItem('userSession')
      if (savedSession) {
        const session = JSON.parse(savedSession)
        if (session.expiresAt && Date.now() < session.expiresAt) {
          const user = await mockDBUserHandlers.findById(session.userId)
          if (user) {
            commit('SET_USER', user)
            commit('SET_AUTHENTICATED', true)
            commit('SET_SESSION', {
              token: session.token,
              expiresAt: session.expiresAt
            })
            await mockDBUserHandlers.updateLastLogin(user._id)
          } else {
            localStorage.removeItem('userSession')
          }
        } else {
          localStorage.removeItem('userSession')
        }
      }
    } catch (error) {
      // 靜默處理錯誤
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async loadLocalUsers({ commit }) {
    try {
      const users = await mockDBUserHandlers.find()
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
      commit('SET_LOCAL_USERS', [])
    }
  },

  async register({ commit, dispatch }, { username, password, displayName = '', avatar = 'default' }) {
    commit('SET_LOADING', true)
    try {
      const trimmedUsername = username.trim().toLowerCase()
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        throw new Error('用戶名長度必須在 3-20 字元之間')
      }
      if (!/^[a-z0-9_-]+$/.test(trimmedUsername)) {
        throw new Error('用戶名只能包含小寫英文字母、數字、底線和連字號')
      }
      const existingUser = await mockDBUserHandlers.findByUsername(trimmedUsername)
      if (existingUser) {
        throw new Error('用戶名已被使用')
      }
      if (password.length < 4) {
        throw new Error('密碼長度至少需要 4 個字元')
      }
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
      await mockDBUserHandlers.create(newUser)
      const session = {
        token: generateSessionToken(),
        expiresAt: now + SESSION_DURATION
      }
      localStorage.setItem('userSession', JSON.stringify({
        userId: newUser._id,
        token: session.token,
        expiresAt: session.expiresAt
      }))
      commit('SET_USER', newUser)
      commit('SET_AUTHENTICATED', true)
      commit('SET_SESSION', session)
      await dispatch('loadLocalUsers')
      return { success: true, user: newUser }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async login({ commit, dispatch }, { username, password }) {
    commit('SET_LOADING', true)
    try {
      const user = await mockDBUserHandlers.findByUsername(username.trim().toLowerCase())
      if (!user) {
        throw new Error('用戶名或密碼錯誤')
      }
      const isValid = await verifyPassword(password, user.passwordHash)
      if (!isValid) {
        throw new Error('用戶名或密碼錯誤')
      }
      const now = Date.now()
      const session = {
        token: generateSessionToken(),
        expiresAt: now + SESSION_DURATION
      }
      localStorage.setItem('userSession', JSON.stringify({
        userId: user._id,
        token: session.token,
        expiresAt: session.expiresAt
      }))
      await mockDBUserHandlers.updateLastLogin(user._id)
      user.lastLoginAt = now
      commit('SET_USER', user)
      commit('SET_AUTHENTICATED', true)
      commit('SET_SESSION', session)
      await dispatch('loadLocalUsers')
      return { success: true, user }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async logout({ commit }) {
    localStorage.removeItem('userSession')
    commit('SET_USER', null)
    commit('SET_AUTHENTICATED', false)
    commit('SET_SESSION', { token: null, expiresAt: null })
    return { success: true }
  },

  async switchUser({ dispatch }, userId) {
    await dispatch('logout')
    const users = await mockDBUserHandlers.find()
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

  async updateProfile({ commit, state }, payload) {
    if (!state.currentUser) {
      return { success: false, error: '未登入' }
    }
    commit('SET_LOADING', true)
    try {
      const updates = { ...state.currentUser }
      if (payload.displayName !== undefined) {
        updates.displayName = payload.displayName.trim() || state.currentUser.username
      }
      if (payload.avatar !== undefined) {
        updates.avatar = payload.avatar
      }
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
      if (payload.preferences !== undefined) {
        updates.preferences = {
          ...state.currentUser.preferences,
          ...payload.preferences
        }
      }
      await mockDBUserHandlers.upsert(updates)
      commit('SET_USER', updates)
      return { success: true, user: updates }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async deleteAccount({ commit, state, dispatch }, password) {
    if (!state.currentUser) {
      return { success: false, error: '未登入' }
    }
    commit('SET_LOADING', true)
    try {
      const isValid = await verifyPassword(password, state.currentUser.passwordHash)
      if (!isValid) {
        throw new Error('密碼錯誤')
      }
      await mockDBUserHandlers.delete(state.currentUser._id)
      await dispatch('logout')
      await dispatch('loadLocalUsers')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async updateUserStats({ commit, state }, stats) {
    if (!state.currentUser) {
      return { success: false, error: '未登入' }
    }
    try {
      await mockDBUserHandlers.updateStats(state.currentUser._id, stats)
      commit('UPDATE_USER_STATS', stats)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

// 建立模擬 store context
function createStoreContext(initialState = null) {
  const state = initialState || createState()
  const committedMutations = []

  const commit = (type, payload) => {
    committedMutations.push({ type, payload })
    if (mutations[type]) {
      mutations[type](state, payload)
    }
  }

  const dispatch = async (type, payload) => {
    if (actions[type]) {
      return await actions[type]({ commit, dispatch, state }, payload)
    }
  }

  return { state, commit, dispatch, committedMutations }
}

// ============================================================================
// 測試開始
// ============================================================================

async function runTests() {
  console.log('\n')
  console.log('*'.repeat(60))
  console.log('  User Vuex 模組單元測試')
  console.log('*'.repeat(60))

  // =========================================================================
  // 1. State 初始值測試
  // =========================================================================

  describe('State 初始值', () => {})

  await test('currentUser 初始為 null', async () => {
    const state = createState()
    expect(state.currentUser).toBeNull()
  })

  await test('isAuthenticated 初始為 false', async () => {
    const state = createState()
    expect(state.isAuthenticated).toBe(false)
  })

  await test('isLoading 初始為 false', async () => {
    const state = createState()
    expect(state.isLoading).toBe(false)
  })

  await test('localUsers 初始為空陣列', async () => {
    const state = createState()
    expect(state.localUsers).toHaveLength(0)
    expect(Array.isArray(state.localUsers)).toBe(true)
  })

  await test('session 初始為 { token: null, expiresAt: null }', async () => {
    const state = createState()
    expect(state.session.token).toBeNull()
    expect(state.session.expiresAt).toBeNull()
  })

  // =========================================================================
  // 2. Getters 測試
  // =========================================================================

  describe('Getters', () => {})

  await test('isLoggedIn 未登入應返回 false', async () => {
    const state = createState()
    expect(getters.isLoggedIn(state)).toBe(false)
  })

  await test('isLoggedIn 已登入應返回 true', async () => {
    const state = createState()
    state.isAuthenticated = true
    state.currentUser = { _id: 'user-123', username: 'testuser' }
    expect(getters.isLoggedIn(state)).toBe(true)
  })

  await test('isLoggedIn 僅 isAuthenticated 為 true 但無 currentUser 應返回 false', async () => {
    const state = createState()
    state.isAuthenticated = true
    state.currentUser = null
    expect(getters.isLoggedIn(state)).toBe(false)
  })

  await test('currentUserId 應返回正確 ID', async () => {
    const state = createState()
    state.currentUser = { _id: 'user-456', username: 'testuser' }
    expect(getters.currentUserId(state)).toBe('user-456')
  })

  await test('currentUserId 未登入應返回 null', async () => {
    const state = createState()
    expect(getters.currentUserId(state)).toBeNull()
  })

  await test('currentUsername 應返回正確用戶名', async () => {
    const state = createState()
    state.currentUser = { _id: 'user-123', username: 'myusername' }
    expect(getters.currentUsername(state)).toBe('myusername')
  })

  await test('currentUsername 未登入應返回 null', async () => {
    const state = createState()
    expect(getters.currentUsername(state)).toBeNull()
  })

  await test('currentUserAvatar 應返回正確頭像', async () => {
    const state = createState()
    state.currentUser = { _id: 'user-123', avatar: 'avatar-blue' }
    expect(getters.currentUserAvatar(state)).toBe('avatar-blue')
  })

  await test('currentUserAvatar 未設定應返回 default', async () => {
    const state = createState()
    expect(getters.currentUserAvatar(state)).toBe('default')
  })

  await test('userPreferences 應返回偏好設定', async () => {
    const state = createState()
    state.currentUser = {
      _id: 'user-123',
      preferences: { theme: 'dark', language: 'zh-TW' }
    }
    expect(getters.userPreferences(state).theme).toBe('dark')
    expect(getters.userPreferences(state).language).toBe('zh-TW')
  })

  await test('userPreferences 未登入應返回空物件', async () => {
    const state = createState()
    const prefs = getters.userPreferences(state)
    expect(JSON.stringify(prefs)).toBe('{}')
  })

  await test('currentDisplayName 應返回顯示名稱', async () => {
    const state = createState()
    state.currentUser = { _id: 'user-123', displayName: '小明', username: 'xiaoming' }
    expect(getters.currentDisplayName(state)).toBe('小明')
  })

  await test('currentDisplayName 無 displayName 時應返回 username', async () => {
    const state = createState()
    state.currentUser = { _id: 'user-123', username: 'xiaoming' }
    expect(getters.currentDisplayName(state)).toBe('xiaoming')
  })

  await test('currentDisplayName 未登入應返回 null', async () => {
    const state = createState()
    expect(getters.currentDisplayName(state)).toBeNull()
  })

  await test('currentUserStats 應返回統計數據', async () => {
    const state = createState()
    state.currentUser = {
      _id: 'user-123',
      stats: { totalWatchTime: 3600, videosWatched: 10 }
    }
    expect(getters.currentUserStats(state).totalWatchTime).toBe(3600)
    expect(getters.currentUserStats(state).videosWatched).toBe(10)
  })

  await test('currentUserStats 未登入應返回預設統計', async () => {
    const state = createState()
    const stats = getters.currentUserStats(state)
    expect(stats.totalWatchTime).toBe(0)
    expect(stats.videosWatched).toBe(0)
  })

  await test('getLocalUsers 應返回本地用戶列表', async () => {
    const state = createState()
    state.localUsers = [
      { _id: 'user-1', username: 'user1' },
      { _id: 'user-2', username: 'user2' }
    ]
    expect(getters.getLocalUsers(state)).toHaveLength(2)
  })

  await test('localUsers getter 別名應與 getLocalUsers 相同', async () => {
    const state = createState()
    state.localUsers = [{ _id: 'user-1', username: 'user1' }]
    expect(getters.localUsers(state)).toEqual(getters.getLocalUsers(state))
  })

  await test('isSessionValid 有效會話應返回 true', async () => {
    const state = createState()
    state.session = {
      token: 'valid-token',
      expiresAt: Date.now() + 3600000 // 1 小時後過期
    }
    expect(getters.isSessionValid(state)).toBe(true)
  })

  await test('isSessionValid 過期會話應返回 false', async () => {
    const state = createState()
    state.session = {
      token: 'expired-token',
      expiresAt: Date.now() - 1000 // 已過期
    }
    expect(getters.isSessionValid(state)).toBe(false)
  })

  await test('isSessionValid 無 token 應返回 false', async () => {
    const state = createState()
    state.session = { token: null, expiresAt: Date.now() + 3600000 }
    expect(getters.isSessionValid(state)).toBe(false)
  })

  await test('isSessionValid 無 expiresAt 應返回 false', async () => {
    const state = createState()
    state.session = { token: 'some-token', expiresAt: null }
    expect(getters.isSessionValid(state)).toBe(false)
  })

  await test('syncEnabled 應返回 false', async () => {
    expect(getters.syncEnabled()).toBe(false)
  })

  await test('isSyncing 應返回 false', async () => {
    expect(getters.isSyncing()).toBe(false)
  })

  await test('hasSyncError 應返回 false', async () => {
    expect(getters.hasSyncError()).toBe(false)
  })

  // =========================================================================
  // 3. Mutations 測試
  // =========================================================================

  describe('Mutations', () => {})

  await test('SET_USER 應設定當前用戶', async () => {
    const state = createState()
    const user = { _id: 'user-123', username: 'testuser' }
    mutations.SET_USER(state, user)
    expect(state.currentUser._id).toBe('user-123')
    expect(state.currentUser.username).toBe('testuser')
  })

  await test('SET_USER 設定 null 應清除用戶', async () => {
    const state = createState()
    state.currentUser = { _id: 'user-123' }
    mutations.SET_USER(state, null)
    expect(state.currentUser).toBeNull()
  })

  await test('SET_AUTHENTICATED 應設定認證狀態為 true', async () => {
    const state = createState()
    mutations.SET_AUTHENTICATED(state, true)
    expect(state.isAuthenticated).toBe(true)
  })

  await test('SET_AUTHENTICATED 應設定認證狀態為 false', async () => {
    const state = createState()
    state.isAuthenticated = true
    mutations.SET_AUTHENTICATED(state, false)
    expect(state.isAuthenticated).toBe(false)
  })

  await test('SET_LOADING 應設定載入狀態為 true', async () => {
    const state = createState()
    mutations.SET_LOADING(state, true)
    expect(state.isLoading).toBe(true)
  })

  await test('SET_LOADING 應設定載入狀態為 false', async () => {
    const state = createState()
    state.isLoading = true
    mutations.SET_LOADING(state, false)
    expect(state.isLoading).toBe(false)
  })

  await test('SET_LOCAL_USERS 應設定本地用戶列表', async () => {
    const state = createState()
    const users = [
      { _id: 'user-1', username: 'user1' },
      { _id: 'user-2', username: 'user2' }
    ]
    mutations.SET_LOCAL_USERS(state, users)
    expect(state.localUsers).toHaveLength(2)
    expect(state.localUsers[0].username).toBe('user1')
  })

  await test('SET_LOCAL_USERS 空陣列應清空列表', async () => {
    const state = createState()
    state.localUsers = [{ _id: 'user-1' }]
    mutations.SET_LOCAL_USERS(state, [])
    expect(state.localUsers).toHaveLength(0)
  })

  await test('SET_SESSION 應設定會話資訊', async () => {
    const state = createState()
    const session = { token: 'abc123', expiresAt: 1234567890 }
    mutations.SET_SESSION(state, session)
    expect(state.session.token).toBe('abc123')
    expect(state.session.expiresAt).toBe(1234567890)
  })

  await test('UPDATE_USER_STATS 應更新統計數據', async () => {
    const state = createState()
    state.currentUser = {
      _id: 'user-123',
      stats: { totalWatchTime: 100, videosWatched: 5 }
    }
    mutations.UPDATE_USER_STATS(state, { totalWatchTime: 200, videosWatched: 10 })
    expect(state.currentUser.stats.totalWatchTime).toBe(200)
    expect(state.currentUser.stats.videosWatched).toBe(10)
  })

  await test('UPDATE_USER_STATS 應合併現有統計', async () => {
    const state = createState()
    state.currentUser = {
      _id: 'user-123',
      stats: { totalWatchTime: 100, videosWatched: 5, subscriptionCount: 3 }
    }
    mutations.UPDATE_USER_STATS(state, { videosWatched: 6 })
    expect(state.currentUser.stats.totalWatchTime).toBe(100)
    expect(state.currentUser.stats.videosWatched).toBe(6)
    expect(state.currentUser.stats.subscriptionCount).toBe(3)
  })

  await test('UPDATE_USER_STATS 無用戶時不應報錯', async () => {
    const state = createState()
    // 不應拋出錯誤
    mutations.UPDATE_USER_STATS(state, { totalWatchTime: 100 })
    expect(state.currentUser).toBeNull()
  })

  // =========================================================================
  // 4. Actions 測試
  // =========================================================================

  describe('Actions - register', () => {})

  await test('有效資料應成功註冊', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    const result = await dispatch('register', {
      username: 'newuser',
      password: 'password123',
      displayName: '新用戶'
    })
    expect(result.success).toBe(true)
    expect(state.currentUser.username).toBe('newuser')
  })

  await test('用戶名已存在應拋出錯誤', async () => {
    resetMocks()
    // 先註冊一個用戶
    mockDBUsers.push({
      _id: 'existing-user',
      username: 'existinguser',
      passwordHash: 'somehash'
    })

    const { dispatch } = createStoreContext()
    const result = await dispatch('register', {
      username: 'existinguser',
      password: 'password123'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('用戶名已被使用')
  })

  await test('用戶名太短應拋出錯誤', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('register', {
      username: 'ab',
      password: 'password123'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('用戶名長度必須在 3-20 字元之間')
  })

  await test('用戶名包含非法字元應拋出錯誤', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('register', {
      username: 'user@name',
      password: 'password123'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('用戶名只能包含小寫英文字母、數字、底線和連字號')
  })

  await test('密碼太短應拋出錯誤', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('register', {
      username: 'validuser',
      password: '123'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('密碼長度至少需要 4 個字元')
  })

  await test('註冊後應自動登入', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('register', {
      username: 'autouser',
      password: 'password123'
    })
    expect(state.isAuthenticated).toBe(true)
    expect(state.currentUser).toBeTruthy()
  })

  await test('應更新 localUsers', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('register', {
      username: 'localuser',
      password: 'password123'
    })
    expect(state.localUsers.length).toBeGreaterThan(0)
  })

  await test('應儲存會話到 localStorage', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    await dispatch('register', {
      username: 'sessionuser',
      password: 'password123'
    })
    const session = JSON.parse(localStorage.getItem('userSession'))
    expect(session).toBeTruthy()
    expect(session.token).toBeTruthy()
  })

  describe('Actions - login', () => {})

  await test('正確帳密應成功登入', async () => {
    resetMocks()
    // 先建立用戶
    const passwordHash = await hashPassword('correct123')
    mockDBUsers.push({
      _id: 'login-user',
      username: 'loginuser',
      passwordHash,
      displayName: '登入用戶',
      stats: getDefaultStats()
    })

    const { dispatch, state } = createStoreContext()
    const result = await dispatch('login', {
      username: 'loginuser',
      password: 'correct123'
    })
    expect(result.success).toBe(true)
    expect(state.currentUser.username).toBe('loginuser')
  })

  await test('錯誤密碼應拋出錯誤', async () => {
    resetMocks()
    const passwordHash = await hashPassword('correct123')
    mockDBUsers.push({
      _id: 'wrong-pw-user',
      username: 'wrongpwuser',
      passwordHash
    })

    const { dispatch } = createStoreContext()
    const result = await dispatch('login', {
      username: 'wrongpwuser',
      password: 'wrongpassword'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('用戶名或密碼錯誤')
  })

  await test('不存在的用戶應拋出錯誤', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('login', {
      username: 'nonexistent',
      password: 'anypassword'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('用戶名或密碼錯誤')
  })

  await test('登入後應設定 currentUser', async () => {
    resetMocks()
    const passwordHash = await hashPassword('test1234')
    mockDBUsers.push({
      _id: 'set-user-test',
      username: 'setusertest',
      passwordHash,
      displayName: '設定用戶'
    })

    const { dispatch, state } = createStoreContext()
    await dispatch('login', {
      username: 'setusertest',
      password: 'test1234'
    })
    expect(state.currentUser._id).toBe('set-user-test')
  })

  await test('登入後應設定 isAuthenticated', async () => {
    resetMocks()
    const passwordHash = await hashPassword('auth1234')
    mockDBUsers.push({
      _id: 'auth-test',
      username: 'authtest',
      passwordHash
    })

    const { dispatch, state } = createStoreContext()
    await dispatch('login', {
      username: 'authtest',
      password: 'auth1234'
    })
    expect(state.isAuthenticated).toBe(true)
  })

  await test('登入應儲存會話到 localStorage', async () => {
    resetMocks()
    const passwordHash = await hashPassword('session1234')
    mockDBUsers.push({
      _id: 'session-test',
      username: 'sessiontest',
      passwordHash
    })

    const { dispatch } = createStoreContext()
    await dispatch('login', {
      username: 'sessiontest',
      password: 'session1234'
    })
    const session = JSON.parse(localStorage.getItem('userSession'))
    expect(session.userId).toBe('session-test')
  })

  describe('Actions - logout', () => {})

  await test('登出後應清除 currentUser', async () => {
    resetMocks()
    const state = createState()
    state.currentUser = { _id: 'user-123', username: 'testuser' }
    state.isAuthenticated = true
    const { dispatch } = createStoreContext(state)

    await dispatch('logout')
    expect(state.currentUser).toBeNull()
  })

  await test('登出後應清除 isAuthenticated', async () => {
    resetMocks()
    const state = createState()
    state.isAuthenticated = true
    const { dispatch } = createStoreContext(state)

    await dispatch('logout')
    expect(state.isAuthenticated).toBe(false)
  })

  await test('登出應清除 localStorage', async () => {
    resetMocks()
    localStorage.setItem('userSession', JSON.stringify({ userId: 'test' }))
    const { dispatch } = createStoreContext()

    await dispatch('logout')
    expect(localStorage.getItem('userSession')).toBeNull()
  })

  await test('登出後應清除 session', async () => {
    resetMocks()
    const state = createState()
    state.session = { token: 'abc', expiresAt: 123456 }
    const { dispatch } = createStoreContext(state)

    await dispatch('logout')
    expect(state.session.token).toBeNull()
    expect(state.session.expiresAt).toBeNull()
  })

  describe('Actions - switchUser', () => {})

  await test('切換到存在的用戶應返回 needsLogin', async () => {
    resetMocks()
    mockDBUsers.push({
      _id: 'switch-target',
      username: 'switchuser',
      displayName: '切換目標'
    })

    const { dispatch } = createStoreContext()
    const result = await dispatch('switchUser', 'switch-target')
    expect(result.success).toBe(true)
    expect(result.needsLogin).toBe(true)
    expect(result.user.username).toBe('switchuser')
  })

  await test('切換到不存在的用戶應失敗', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('switchUser', 'nonexistent-id')
    expect(result.success).toBe(false)
    expect(result.error).toBe('找不到該用戶')
  })

  await test('切換用戶應先登出當前用戶', async () => {
    resetMocks()
    mockDBUsers.push({
      _id: 'new-user',
      username: 'newuser'
    })

    const state = createState()
    state.currentUser = { _id: 'old-user', username: 'olduser' }
    state.isAuthenticated = true
    const { dispatch } = createStoreContext(state)

    await dispatch('switchUser', 'new-user')
    expect(state.isAuthenticated).toBe(false)
    expect(state.currentUser).toBeNull()
  })

  describe('Actions - updateProfile', () => {})

  await test('更新 displayName 應成功', async () => {
    resetMocks()
    const passwordHash = await hashPassword('test1234')
    const userData = {
      _id: 'update-user',
      username: 'updateuser',
      displayName: '原名稱',
      passwordHash
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('updateProfile', { displayName: '新名稱' })
    expect(result.success).toBe(true)
    expect(state.currentUser.displayName).toBe('新名稱')
  })

  await test('更新 avatar 應成功', async () => {
    resetMocks()
    const userData = {
      _id: 'avatar-user',
      username: 'avataruser',
      avatar: 'old-avatar'
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('updateProfile', { avatar: 'new-avatar' })
    expect(result.success).toBe(true)
    expect(state.currentUser.avatar).toBe('new-avatar')
  })

  await test('未登入時更新應失敗', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('updateProfile', { displayName: '新名稱' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('未登入')
  })

  await test('更新密碼需要當前密碼', async () => {
    resetMocks()
    const passwordHash = await hashPassword('old1234')
    const state = createState()
    state.currentUser = {
      _id: 'pw-user',
      username: 'pwuser',
      passwordHash
    }
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('updateProfile', { newPassword: 'new1234' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('請輸入當前密碼')
  })

  await test('錯誤的當前密碼應失敗', async () => {
    resetMocks()
    const passwordHash = await hashPassword('correct1234')
    const state = createState()
    state.currentUser = {
      _id: 'pw-user2',
      username: 'pwuser2',
      passwordHash
    }
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('updateProfile', {
      newPassword: 'new1234',
      currentPassword: 'wrong1234'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('當前密碼錯誤')
  })

  await test('更新偏好設定應成功', async () => {
    resetMocks()
    const userData = {
      _id: 'pref-user',
      username: 'prefuser',
      preferences: { theme: 'light' }
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('updateProfile', {
      preferences: { language: 'zh-TW' }
    })
    expect(result.success).toBe(true)
    expect(state.currentUser.preferences.theme).toBe('light')
    expect(state.currentUser.preferences.language).toBe('zh-TW')
  })

  describe('Actions - deleteAccount', () => {})

  await test('正確密碼應成功刪除', async () => {
    resetMocks()
    const passwordHash = await hashPassword('delete1234')
    const userData = {
      _id: 'delete-user',
      username: 'deleteuser',
      passwordHash
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    state.isAuthenticated = true
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('deleteAccount', 'delete1234')
    expect(result.success).toBe(true)
  })

  await test('刪除後應登出', async () => {
    resetMocks()
    const passwordHash = await hashPassword('delete1234')
    const userData = {
      _id: 'delete-user2',
      username: 'deleteuser2',
      passwordHash
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    state.isAuthenticated = true
    const { dispatch } = createStoreContext(state)

    await dispatch('deleteAccount', 'delete1234')
    expect(state.isAuthenticated).toBe(false)
    expect(state.currentUser).toBeNull()
  })

  await test('應從 localUsers 移除', async () => {
    resetMocks()
    const passwordHash = await hashPassword('delete1234')
    const userData = {
      _id: 'delete-user3',
      username: 'deleteuser3',
      passwordHash
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    state.isAuthenticated = true
    const { dispatch } = createStoreContext(state)

    await dispatch('deleteAccount', 'delete1234')
    const foundUser = mockDBUsers.find(u => u._id === 'delete-user3')
    expect(foundUser).toBeFalsy()
  })

  await test('錯誤密碼應失敗', async () => {
    resetMocks()
    const passwordHash = await hashPassword('correct1234')
    const userData = {
      _id: 'nodelete-user',
      username: 'nodeleteuser',
      passwordHash
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('deleteAccount', 'wrong1234')
    expect(result.success).toBe(false)
    expect(result.error).toBe('密碼錯誤')
  })

  await test('未登入時刪除帳戶應失敗', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('deleteAccount', 'any1234')
    expect(result.success).toBe(false)
    expect(result.error).toBe('未登入')
  })

  describe('Actions - initializeUser', () => {})

  await test('有儲存的有效會話應自動登入', async () => {
    resetMocks()
    mockDBUsers.push({
      _id: 'init-user',
      username: 'inituser',
      displayName: '初始化用戶'
    })
    localStorage.setItem('userSession', JSON.stringify({
      userId: 'init-user',
      token: 'valid-token',
      expiresAt: Date.now() + 3600000
    }))

    const { dispatch, state } = createStoreContext()
    await dispatch('initializeUser')
    expect(state.isAuthenticated).toBe(true)
    expect(state.currentUser.username).toBe('inituser')
  })

  await test('無儲存的會話應保持未登入', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('initializeUser')
    expect(state.isAuthenticated).toBe(false)
    expect(state.currentUser).toBeNull()
  })

  await test('過期的會話應清除', async () => {
    resetMocks()
    localStorage.setItem('userSession', JSON.stringify({
      userId: 'expired-user',
      token: 'expired-token',
      expiresAt: Date.now() - 1000 // 已過期
    }))

    const { dispatch, state } = createStoreContext()
    await dispatch('initializeUser')
    expect(state.isAuthenticated).toBe(false)
    expect(localStorage.getItem('userSession')).toBeNull()
  })

  await test('用戶不存在時應清除會話', async () => {
    resetMocks()
    localStorage.setItem('userSession', JSON.stringify({
      userId: 'nonexistent-user',
      token: 'some-token',
      expiresAt: Date.now() + 3600000
    }))

    const { dispatch, state } = createStoreContext()
    await dispatch('initializeUser')
    expect(state.isAuthenticated).toBe(false)
    expect(localStorage.getItem('userSession')).toBeNull()
  })

  describe('Actions - loadLocalUsers', () => {})

  await test('應載入所有本地用戶', async () => {
    resetMocks()
    mockDBUsers.push(
      { _id: 'user-1', username: 'user1', displayName: '用戶一' },
      { _id: 'user-2', username: 'user2', displayName: '用戶二' },
      { _id: 'user-3', username: 'user3', displayName: '用戶三' }
    )

    const { dispatch, state } = createStoreContext()
    await dispatch('loadLocalUsers')
    expect(state.localUsers).toHaveLength(3)
  })

  await test('載入時應移除敏感資訊', async () => {
    resetMocks()
    mockDBUsers.push({
      _id: 'sensitive-user',
      username: 'sensitiveuser',
      passwordHash: 'secret-hash',
      displayName: '敏感用戶'
    })

    const { dispatch, state } = createStoreContext()
    await dispatch('loadLocalUsers')
    const user = state.localUsers[0]
    expect(user.passwordHash).toBeFalsy()
    expect(user.username).toBe('sensitiveuser')
  })

  await test('空資料庫應返回空陣列', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('loadLocalUsers')
    expect(state.localUsers).toHaveLength(0)
  })

  describe('Actions - updateUserStats', () => {})

  await test('應正確更新統計數據', async () => {
    resetMocks()
    const userData = {
      _id: 'stats-user',
      username: 'statsuser',
      stats: { totalWatchTime: 100, videosWatched: 5 }
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    const { dispatch } = createStoreContext(state)

    const result = await dispatch('updateUserStats', {
      totalWatchTime: 200,
      videosWatched: 10
    })
    expect(result.success).toBe(true)
    expect(state.currentUser.stats.totalWatchTime).toBe(200)
    expect(state.currentUser.stats.videosWatched).toBe(10)
  })

  await test('未登入時更新統計應失敗', async () => {
    resetMocks()
    const { dispatch } = createStoreContext()
    const result = await dispatch('updateUserStats', { totalWatchTime: 100 })
    expect(result.success).toBe(false)
    expect(result.error).toBe('未登入')
  })

  await test('應合併現有統計而非覆蓋', async () => {
    resetMocks()
    const userData = {
      _id: 'merge-stats-user',
      username: 'mergestatsuser',
      stats: {
        totalWatchTime: 100,
        videosWatched: 5,
        subscriptionCount: 10,
        playlistCount: 3
      }
    }
    mockDBUsers.push(userData)

    const state = createState()
    state.currentUser = { ...userData }
    const { dispatch } = createStoreContext(state)

    await dispatch('updateUserStats', { videosWatched: 6 })
    expect(state.currentUser.stats.totalWatchTime).toBe(100)
    expect(state.currentUser.stats.videosWatched).toBe(6)
    expect(state.currentUser.stats.subscriptionCount).toBe(10)
  })

  // =========================================================================
  // 額外邊緣案例測試
  // =========================================================================

  describe('邊緣案例', () => {})

  await test('用戶名應自動轉小寫', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('register', {
      username: 'MyUserName',
      password: 'password123'
    })
    expect(state.currentUser.username).toBe('myusername')
  })

  await test('用戶名前後空白應自動移除', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('register', {
      username: '  trimuser  ',
      password: 'password123'
    })
    expect(state.currentUser.username).toBe('trimuser')
  })

  await test('displayName 為空時應使用 username', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('register', {
      username: 'nodisplay',
      password: 'password123',
      displayName: ''
    })
    expect(state.currentUser.displayName).toBe('nodisplay')
  })

  await test('註冊時應設定預設統計', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('register', {
      username: 'statstest',
      password: 'password123'
    })
    expect(state.currentUser.stats.totalWatchTime).toBe(0)
    expect(state.currentUser.stats.videosWatched).toBe(0)
  })

  await test('註冊時應設定空偏好設定', async () => {
    resetMocks()
    const { dispatch, state } = createStoreContext()
    await dispatch('register', {
      username: 'preftest',
      password: 'password123'
    })
    expect(JSON.stringify(state.currentUser.preferences)).toBe('{}')
  })

  await test('currentUser getter 未登入時應返回訪客物件', async () => {
    const state = createState()
    const user = getters.currentUser(state)
    expect(user.username).toBe('guest')
    expect(user._id).toBeNull()
  })

  // =========================================================================
  // 測試結束，輸出結果
  // =========================================================================

  console.log('\n')
  console.log('*'.repeat(60))
  console.log('  測試結果摘要')
  console.log('*'.repeat(60))
  console.log(`  總測試數: ${testResults.total}`)
  console.log(`  通過: ${testResults.passed}`)
  console.log(`  失敗: ${testResults.failed}`)
  console.log(`  通過率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`)
  console.log('*'.repeat(60))

  if (testResults.failed > 0) {
    console.log('\n失敗的測試:')
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`))
    process.exit(1)
  }
}

// 執行測試
runTests().catch(error => {
  console.error('測試執行錯誤:', error)
  process.exit(1)
})
