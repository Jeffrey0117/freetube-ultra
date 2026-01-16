/**
 * FreeTube Local API Server - User Service
 * 用戶服務層 - 處理用戶相關的業務邏輯
 * @module server/services/userService
 */

'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const config = require('../config')

// === 資料存儲設定 ===
const DATA_DIR = path.join(config.cache.baseDir, 'users')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

// 確保資料目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  console.log('[UserService] Created users data directory:', DATA_DIR)
}

// === 密碼雜湊設定 ===
const PBKDF2_ITERATIONS = 100000
const PBKDF2_KEY_LENGTH = 64
const PBKDF2_DIGEST = 'sha512'
const SALT_LENGTH = 32

/**
 * 使用 PBKDF2 雜湊密碼
 * @param {string} password - 明文密碼
 * @param {string} [salt] - 鹽值（可選，若未提供則自動生成）
 * @returns {Promise<{hash: string, salt: string}>} - 雜湊結果
 */
function hashPassword(password, salt = null) {
  return new Promise((resolve, reject) => {
    // 若未提供 salt，則自動生成
    const saltBuffer = salt
      ? Buffer.from(salt, 'hex')
      : crypto.randomBytes(SALT_LENGTH)

    crypto.pbkdf2(
      password,
      saltBuffer,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
      (err, derivedKey) => {
        if (err) {
          reject(err)
        } else {
          resolve({
            hash: derivedKey.toString('hex'),
            salt: saltBuffer.toString('hex')
          })
        }
      }
    )
  })
}

/**
 * 驗證密碼
 * @param {string} password - 明文密碼
 * @param {string} storedHash - 儲存的雜湊值
 * @param {string} storedSalt - 儲存的鹽值
 * @returns {Promise<boolean>} - 驗證結果
 */
async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, storedSalt)
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(storedHash, 'hex')
  )
}

/**
 * 生成唯一 ID
 * @returns {string} - UUID 格式的唯一 ID
 */
function generateId() {
  return crypto.randomUUID()
}

/**
 * 生成預設頭像 URL
 * @param {string} displayName - 顯示名稱
 * @returns {string} - 頭像 URL（使用 UI Avatars 服務）
 */
function generateDefaultAvatar(displayName) {
  const name = encodeURIComponent(displayName || 'User')
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`
}

/**
 * 載入所有用戶資料
 * @returns {Array<Object>} - 用戶陣列
 */
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('[UserService] Error loading users:', err.message)
  }
  return []
}

/**
 * 儲存所有用戶資料
 * @param {Array<Object>} users - 用戶陣列
 */
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
    console.log('[UserService] Users saved successfully')
  } catch (err) {
    console.error('[UserService] Error saving users:', err.message)
    throw err
  }
}

/**
 * 移除敏感資訊，回傳安全的用戶物件
 * @param {Object} user - 完整用戶物件
 * @returns {Object} - 安全的用戶物件（不含密碼等敏感資訊）
 */
function sanitizeUser(user) {
  if (!user) return null
  const { passwordHash, passwordSalt, ...safeUser } = user
  return safeUser
}

/**
 * 用戶服務類別
 */
class UserService {
  constructor() {
    this.users = loadUsers()
  }

  /**
   * 重新載入用戶資料
   */
  reload() {
    this.users = loadUsers()
  }

  /**
   * 儲存變更
   */
  save() {
    saveUsers(this.users)
  }

  /**
   * 註冊新用戶
   * @param {string} username - 用戶名
   * @param {string} password - 密碼
   * @param {string} [displayName] - 顯示名稱（可選）
   * @returns {Promise<Object>} - 新建的用戶物件（安全版本）
   * @throws {Error} - 若用戶名已存在
   */
  async register(username, password, displayName = null) {
    // 驗證用戶名
    if (!username || typeof username !== 'string') {
      throw new Error('用戶名為必填')
    }
    username = username.trim().toLowerCase()

    if (username.length < 3 || username.length > 20) {
      throw new Error('用戶名長度需為 3-20 字元')
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      throw new Error('用戶名只能包含小寫字母、數字和底線')
    }

    // 驗證密碼
    if (!password || typeof password !== 'string') {
      throw new Error('密碼為必填')
    }

    if (password.length < 6) {
      throw new Error('密碼長度至少需要 6 個字元')
    }

    // 檢查用戶名是否已存在
    const existingUser = this.users.find(u => u.username === username)
    if (existingUser) {
      throw new Error('此用戶名已被使用')
    }

    // 雜湊密碼
    const { hash, salt } = await hashPassword(password)

    // 建立新用戶
    const finalDisplayName = displayName?.trim() || username
    const newUser = {
      _id: generateId(),
      username,
      displayName: finalDisplayName,
      avatar: generateDefaultAvatar(finalDisplayName),
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        watchCount: 0,
        watchTimeSeconds: 0,
        favoriteGenre: null
      }
    }

    // 儲存
    this.users.push(newUser)
    this.save()

    console.log('[UserService] New user registered:', username)
    return sanitizeUser(newUser)
  }

  /**
   * 用戶登入
   * @param {string} username - 用戶名
   * @param {string} password - 密碼
   * @returns {Promise<Object>} - 用戶物件（安全版本）
   * @throws {Error} - 若用戶名或密碼錯誤
   */
  async login(username, password) {
    if (!username || !password) {
      throw new Error('用戶名和密碼為必填')
    }

    username = username.trim().toLowerCase()

    // 查找用戶
    const user = this.users.find(u => u.username === username)
    if (!user) {
      throw new Error('用戶名或密碼錯誤')
    }

    // 驗證密碼
    const isValid = await verifyPassword(password, user.passwordHash, user.passwordSalt)
    if (!isValid) {
      throw new Error('用戶名或密碼錯誤')
    }

    console.log('[UserService] User logged in:', username)
    return sanitizeUser(user)
  }

  /**
   * 透過 ID 查找用戶
   * @param {string} id - 用戶 ID
   * @returns {Object|null} - 用戶物件（安全版本）或 null
   */
  findById(id) {
    const user = this.users.find(u => u._id === id)
    return sanitizeUser(user)
  }

  /**
   * 透過用戶名查找用戶
   * @param {string} username - 用戶名
   * @returns {Object|null} - 用戶物件（安全版本）或 null
   */
  findByUsername(username) {
    if (!username) return null
    username = username.trim().toLowerCase()
    const user = this.users.find(u => u.username === username)
    return sanitizeUser(user)
  }

  /**
   * 更新用戶個人檔案
   * @param {string} id - 用戶 ID
   * @param {Object} data - 要更新的資料
   * @param {string} [data.displayName] - 新的顯示名稱
   * @param {string} [data.avatar] - 新的頭像 URL
   * @returns {Object} - 更新後的用戶物件（安全版本）
   * @throws {Error} - 若用戶不存在
   */
  updateProfile(id, data) {
    const userIndex = this.users.findIndex(u => u._id === id)
    if (userIndex === -1) {
      throw new Error('用戶不存在')
    }

    const user = this.users[userIndex]

    // 更新允許的欄位
    if (data.displayName && typeof data.displayName === 'string') {
      const newDisplayName = data.displayName.trim()
      if (newDisplayName.length > 0 && newDisplayName.length <= 50) {
        user.displayName = newDisplayName
      }
    }

    if (data.avatar && typeof data.avatar === 'string') {
      // 簡單驗證 URL 格式
      if (data.avatar.startsWith('http://') || data.avatar.startsWith('https://') || data.avatar.startsWith('data:image/')) {
        user.avatar = data.avatar
      }
    }

    user.updatedAt = new Date().toISOString()

    // 儲存
    this.users[userIndex] = user
    this.save()

    console.log('[UserService] User profile updated:', user.username)
    return sanitizeUser(user)
  }

  /**
   * 刪除用戶帳戶
   * @param {string} id - 用戶 ID
   * @returns {boolean} - 是否成功刪除
   * @throws {Error} - 若用戶不存在
   */
  deleteAccount(id) {
    const userIndex = this.users.findIndex(u => u._id === id)
    if (userIndex === -1) {
      throw new Error('用戶不存在')
    }

    const deletedUser = this.users[userIndex]
    this.users.splice(userIndex, 1)
    this.save()

    console.log('[UserService] User account deleted:', deletedUser.username)
    return true
  }

  /**
   * 取得所有本地用戶（用於切換帳戶）
   * @returns {Array<Object>} - 用戶陣列（安全版本，僅含基本資訊）
   */
  getAllUsers() {
    return this.users.map(user => ({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar
    }))
  }

  /**
   * 更新用戶統計資料
   * @param {string} id - 用戶 ID
   * @param {Object} stats - 統計資料
   * @param {number} [stats.watchCount] - 觀看次數增量
   * @param {number} [stats.watchTimeSeconds] - 觀看時間增量（秒）
   * @param {string} [stats.favoriteGenre] - 最喜歡的類型
   * @returns {Object} - 更新後的用戶物件（安全版本）
   * @throws {Error} - 若用戶不存在
   */
  updateStats(id, stats) {
    const userIndex = this.users.findIndex(u => u._id === id)
    if (userIndex === -1) {
      throw new Error('用戶不存在')
    }

    const user = this.users[userIndex]

    // 確保 stats 物件存在
    if (!user.stats) {
      user.stats = {
        watchCount: 0,
        watchTimeSeconds: 0,
        favoriteGenre: null
      }
    }

    // 更新統計資料（累加方式）
    if (typeof stats.watchCount === 'number') {
      user.stats.watchCount = (user.stats.watchCount || 0) + stats.watchCount
    }

    if (typeof stats.watchTimeSeconds === 'number') {
      user.stats.watchTimeSeconds = (user.stats.watchTimeSeconds || 0) + stats.watchTimeSeconds
    }

    if (stats.favoriteGenre && typeof stats.favoriteGenre === 'string') {
      user.stats.favoriteGenre = stats.favoriteGenre
    }

    user.updatedAt = new Date().toISOString()

    // 儲存
    this.users[userIndex] = user
    this.save()

    return sanitizeUser(user)
  }

  /**
   * 變更密碼
   * @param {string} id - 用戶 ID
   * @param {string} currentPassword - 目前密碼
   * @param {string} newPassword - 新密碼
   * @returns {Promise<boolean>} - 是否成功變更
   * @throws {Error} - 若驗證失敗
   */
  async changePassword(id, currentPassword, newPassword) {
    const userIndex = this.users.findIndex(u => u._id === id)
    if (userIndex === -1) {
      throw new Error('用戶不存在')
    }

    const user = this.users[userIndex]

    // 驗證目前密碼
    const isValid = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt)
    if (!isValid) {
      throw new Error('目前密碼錯誤')
    }

    // 驗證新密碼
    if (!newPassword || newPassword.length < 6) {
      throw new Error('新密碼長度至少需要 6 個字元')
    }

    // 雜湊新密碼
    const { hash, salt } = await hashPassword(newPassword)
    user.passwordHash = hash
    user.passwordSalt = salt
    user.updatedAt = new Date().toISOString()

    // 儲存
    this.users[userIndex] = user
    this.save()

    console.log('[UserService] Password changed for user:', user.username)
    return true
  }
}

// 匯出單例實例
const userService = new UserService()

module.exports = {
  userService,
  UserService,
  // 匯出工具函數供測試使用
  hashPassword,
  verifyPassword,
  generateId,
  sanitizeUser
}
