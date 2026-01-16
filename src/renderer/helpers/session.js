/**
 * 會話管理工具
 * 處理本地會話儲存和驗證
 */

// ============================================================================
// 常數定義
// ============================================================================

/**
 * localStorage 鍵名
 */
const STORAGE_KEYS = {
  SESSION: 'freetube_session',
  REMEMBERED_USER: 'freetube_remembered_user'
}

/**
 * 預設會話過期時間（24 小時，以毫秒為單位）
 */
const DEFAULT_SESSION_DURATION = 24 * 60 * 60 * 1000

// ============================================================================
// 會話儲存函數
// ============================================================================

/**
 * 儲存會話資訊到 localStorage
 * @param {string} userId - 用戶 ID
 * @param {string} token - 會話 Token
 * @param {number} [expiresAt] - 過期時間戳（毫秒），預設為 24 小時後
 */
function saveSession(userId, token, expiresAt) {
  if (!userId || !token) {
    console.error('[Session] saveSession: userId 和 token 為必填參數')
    return
  }

  const session = {
    userId,
    token,
    expiresAt: expiresAt || (Date.now() + DEFAULT_SESSION_DURATION),
    createdAt: Date.now()
  }

  try {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
  } catch (error) {
    console.error('[Session] 儲存會話失敗:', error)
  }
}

/**
 * 從 localStorage 取得會話資訊
 * @returns {{ userId: string, token: string, expiresAt: number, createdAt: number } | null}
 */
function getSession() {
  try {
    const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION)
    if (!sessionStr) {
      return null
    }

    const session = JSON.parse(sessionStr)

    // 驗證會話結構
    if (!session.userId || !session.token || !session.expiresAt) {
      console.warn('[Session] 會話結構無效，清除會話')
      clearSession()
      return null
    }

    return session
  } catch (error) {
    console.error('[Session] 讀取會話失敗:', error)
    clearSession()
    return null
  }
}

/**
 * 清除會話資訊
 */
function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION)
  } catch (error) {
    console.error('[Session] 清除會話失敗:', error)
  }
}

/**
 * 檢查會話是否有效（存在且未過期）
 * @returns {boolean}
 */
function isSessionValid() {
  const session = getSession()

  if (!session) {
    return false
  }

  // 檢查是否已過期
  if (Date.now() > session.expiresAt) {
    console.info('[Session] 會話已過期')
    clearSession()
    return false
  }

  return true
}

// ============================================================================
// 自動登入（記住我）功能
// ============================================================================

/**
 * 取得記住的用戶 ID
 * @returns {string | null}
 */
function getRememberedUser() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REMEMBERED_USER)
    if (!data) {
      return null
    }

    const parsed = JSON.parse(data)
    return parsed.userId || null
  } catch (error) {
    console.error('[Session] 讀取記住的用戶失敗:', error)
    return null
  }
}

/**
 * 設定記住的用戶 ID（用於自動登入）
 * @param {string} userId - 用戶 ID
 */
function setRememberedUser(userId) {
  if (!userId) {
    console.error('[Session] setRememberedUser: userId 為必填參數')
    return
  }

  try {
    const data = {
      userId,
      rememberedAt: Date.now()
    }
    localStorage.setItem(STORAGE_KEYS.REMEMBERED_USER, JSON.stringify(data))
  } catch (error) {
    console.error('[Session] 儲存記住的用戶失敗:', error)
  }
}

/**
 * 清除記住的用戶（取消自動登入）
 */
function clearRememberedUser() {
  try {
    localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER)
  } catch (error) {
    console.error('[Session] 清除記住的用戶失敗:', error)
  }
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 延長會話時間
 * @param {number} [additionalTime] - 額外時間（毫秒），預設為 24 小時
 * @returns {boolean} - 是否成功延長
 */
function extendSession(additionalTime = DEFAULT_SESSION_DURATION) {
  const session = getSession()

  if (!session) {
    return false
  }

  // 更新過期時間
  session.expiresAt = Date.now() + additionalTime

  try {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
    return true
  } catch (error) {
    console.error('[Session] 延長會話失敗:', error)
    return false
  }
}

/**
 * 取得會話剩餘時間（毫秒）
 * @returns {number} - 剩餘時間，若會話無效則返回 0
 */
function getSessionRemainingTime() {
  const session = getSession()

  if (!session) {
    return 0
  }

  const remaining = session.expiresAt - Date.now()
  return remaining > 0 ? remaining : 0
}

/**
 * 完全清除所有會話相關資料（登出時使用）
 */
function clearAllSessionData() {
  clearSession()
  clearRememberedUser()
}

// ============================================================================
// 匯出
// ============================================================================

module.exports = {
  // 常數
  STORAGE_KEYS,
  DEFAULT_SESSION_DURATION,

  // 會話儲存
  saveSession,
  getSession,
  clearSession,
  isSessionValid,

  // 自動登入
  getRememberedUser,
  setRememberedUser,
  clearRememberedUser,

  // 輔助函數
  extendSession,
  getSessionRemainingTime,
  clearAllSessionData
}
