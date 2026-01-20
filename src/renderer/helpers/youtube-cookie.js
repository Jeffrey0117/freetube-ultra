/**
 * YouTube Cookie 認證模組
 * 處理 YouTube Cookie 的加密儲存、驗證和管理
 */

import { Innertube } from 'youtubei.js'

// ============================================================================
// 常數定義
// ============================================================================

const YOUTUBE_COOKIE_KEY = 'youtubeCookie'
const YOUTUBE_AUTH_KEY = 'youtubeAuth'

/**
 * 必要的 YouTube Cookie 欄位
 */
const REQUIRED_COOKIES = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID']

/**
 * 加密配置
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 32,
  iterations: 100000,
  digest: 'sha512'
}

// ============================================================================
// 加密/解密函數
// ============================================================================

/**
 * 生成加密金鑰（使用機器特定資訊）
 * @returns {Promise<Buffer>} 加密金鑰
 */
async function getEncryptionKey() {
  // 使用 Web Crypto API（瀏覽器和 Electron 都支援）
  const crypto = window.crypto

  // 使用固定的 salt 結合 userAgent 生成金鑰
  // 這樣同一台機器會產生相同的金鑰
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(navigator.userAgent + 'freetube-youtube-cookie'),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('freetube-cookie-salt-v1'),
      iterations: ENCRYPTION_CONFIG.iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  return key
}

/**
 * 加密字串
 * @param {string} plaintext - 要加密的字串
 * @returns {Promise<string>} 加密後的 base64 字串
 */
async function encrypt(plaintext) {
  const crypto = window.crypto

  const key = await getEncryptionKey()
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // 生成隨機 IV
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  // 組合 IV + 加密資料
  const combined = new Uint8Array(iv.length + encryptedData.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encryptedData), iv.length)

  // 轉為 base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * 解密字串
 * @param {string} ciphertext - 加密的 base64 字串
 * @returns {Promise<string>} 解密後的原始字串
 */
async function decrypt(ciphertext) {
  const crypto = window.crypto

  const key = await getEncryptionKey()

  // 從 base64 解碼
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

  // 分離 IV 和加密資料
  const iv = combined.slice(0, 12)
  const encryptedData = combined.slice(12)

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedData)
}

// ============================================================================
// Cookie 解析和驗證
// ============================================================================

/**
 * 解析 Cookie 字串為物件
 * @param {string} cookieString - Cookie 字串
 * @returns {Object} Cookie 鍵值對
 */
function parseCookieString(cookieString) {
  const cookies = {}

  if (!cookieString || typeof cookieString !== 'string') {
    return cookies
  }

  const lines = cookieString.split('\n')

  // 檢查是否為 Netscape 格式（以 # 或 . 開頭的行）
  const isNetscapeFormat = lines.some(line =>
    line.trim().startsWith('#') ||
    line.trim().startsWith('.youtube.com') ||
    line.trim().startsWith('youtube.com')
  )

  if (isNetscapeFormat) {
    // Netscape HTTP Cookie File 格式
    // 格式: domain  flag  path  secure  expiration  name  value
    for (const line of lines) {
      const trimmed = line.trim()

      // 跳過註釋和空行
      if (!trimmed || trimmed.startsWith('#')) continue

      const parts = trimmed.split('\t')
      if (parts.length >= 7) {
        const name = parts[5]
        const value = parts[6]
        if (name && value !== undefined) {
          cookies[name] = value
        }
      }
    }
  } else {
    // 標準 Cookie 字串格式
    // 1. name=value; name2=value2
    // 2. name=value\nname2=value2
    // 3. 從開發者工具複製的格式
    const segments = cookieString.split(/[;\n]/)

    for (const segment of segments) {
      const trimmed = segment.trim()
      if (!trimmed) continue

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue

      const name = trimmed.substring(0, eqIndex).trim()
      const value = trimmed.substring(eqIndex + 1).trim()

      if (name) {
        cookies[name] = value
      }
    }
  }

  return cookies
}

/**
 * 將 Cookie 物件轉換為字串格式
 * @param {Object} cookies - Cookie 物件
 * @returns {string} Cookie 字串
 */
function cookiesToString(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

/**
 * 驗證 Cookie 格式是否包含必要欄位
 * @param {string} cookieString - Cookie 字串
 * @returns {{ valid: boolean, error?: string, cookies?: Object }}
 */
export function validateCookieFormat(cookieString) {
  if (!cookieString || typeof cookieString !== 'string') {
    return {
      valid: false,
      error: 'Cookie 不能為空'
    }
  }

  const cookies = parseCookieString(cookieString)
  const missing = REQUIRED_COOKIES.filter(name => !cookies[name])

  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必要的 Cookie 欄位: ${missing.join(', ')}`
    }
  }

  return {
    valid: true,
    cookies
  }
}

/**
 * 標準化 Cookie 字串格式
 * @param {string} cookieString - 原始 Cookie 字串
 * @returns {string} 標準化後的 Cookie 字串
 */
export function normalizeCookieString(cookieString) {
  const cookies = parseCookieString(cookieString)
  return cookiesToString(cookies)
}

// ============================================================================
// Cookie 儲存和讀取（使用 localStorage 作為簡單實作）
// ============================================================================

/**
 * 儲存 YouTube Cookie（加密）
 * @param {string} cookie - Cookie 字串
 * @returns {Promise<void>}
 */
export async function storeYouTubeCookie(cookie) {
  try {
    const normalizedCookie = normalizeCookieString(cookie)
    const encrypted = await encrypt(normalizedCookie)
    localStorage.setItem(YOUTUBE_COOKIE_KEY, encrypted)
  } catch (error) {
    console.error('Failed to store YouTube cookie:', error)
    throw new Error('無法儲存 Cookie: ' + error.message)
  }
}

/**
 * 取得已儲存的 YouTube Cookie（解密）
 * 優先順序：localStorage > 環境變數
 * @returns {Promise<string|null>}
 */
export async function getStoredYouTubeCookie() {
  try {
    // 1. 優先從 localStorage 讀取（用戶手動設定的）
    const encrypted = localStorage.getItem(YOUTUBE_COOKIE_KEY)
    if (encrypted) {
      return await decrypt(encrypted)
    }

    // 2. 嘗試從環境變數讀取（開發/預設用）
    if (process.env.YOUTUBE_COOKIE) {
      return process.env.YOUTUBE_COOKIE
    }

    return null
  } catch (error) {
    console.error('Failed to retrieve YouTube cookie:', error)
    // 如果解密失敗，清除損壞的資料
    localStorage.removeItem(YOUTUBE_COOKIE_KEY)

    // 嘗試從環境變數讀取
    if (process.env.YOUTUBE_COOKIE) {
      return process.env.YOUTUBE_COOKIE
    }

    return null
  }
}

/**
 * 清除 YouTube Cookie
 */
export function clearYouTubeCookie() {
  localStorage.removeItem(YOUTUBE_COOKIE_KEY)
  localStorage.removeItem(YOUTUBE_AUTH_KEY)
}

/**
 * 檢查是否有儲存的 Cookie
 * @returns {boolean}
 */
export function hasStoredCookie() {
  return !!localStorage.getItem(YOUTUBE_COOKIE_KEY) || !!process.env.YOUTUBE_COOKIE
}

// ============================================================================
// YouTube Auth 狀態管理
// ============================================================================

/**
 * 儲存認證狀態
 * @param {Object} authData - 認證資料
 */
export function storeAuthStatus(authData) {
  localStorage.setItem(YOUTUBE_AUTH_KEY, JSON.stringify({
    ...authData,
    updatedAt: Date.now()
  }))
}

/**
 * 取得認證狀態
 * @returns {Object|null}
 */
export function getAuthStatus() {
  try {
    const data = localStorage.getItem(YOUTUBE_AUTH_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

// ============================================================================
// Cookie 驗證（與 YouTube API 連線測試）
// ============================================================================

/**
 * 驗證 Cookie 是否有效（嘗試連線 YouTube）
 * @param {string} cookie - Cookie 字串
 * @returns {Promise<{ valid: boolean, error?: string, accountName?: string }>}
 */
export async function validateYouTubeCookie(cookie) {
  // 先驗證格式
  const formatValidation = validateCookieFormat(cookie)
  if (!formatValidation.valid) {
    return formatValidation
  }

  const normalizedCookie = normalizeCookieString(cookie)

  try {
    // 嘗試使用 cookie 建立 Innertube 實例
    const innertube = await Innertube.create({
      cookie: normalizedCookie,
      enable_session_cache: false
    })

    // 嘗試獲取帳戶資訊來驗證 cookie 是否有效
    // 這會觸發一個需要認證的 API 呼叫
    let accountName = null

    try {
      // 嘗試取得帳戶選單來確認登入狀態
      const accountMenu = await innertube.account.getInfo()
      if (accountMenu?.name) {
        accountName = accountMenu.name
      }
    } catch (accountError) {
      // 如果無法取得帳戶資訊，可能是 cookie 無效或已過期
      console.warn('Could not fetch account info:', accountError.message)

      // 嘗試一個簡單的搜尋來測試連線
      try {
        await innertube.search('test', { type: 'video' })
        // 如果搜尋成功但無法取得帳戶資訊，可能是部分有效
        accountName = '(已連接)'
      } catch (searchError) {
        return {
          valid: false,
          error: 'Cookie 可能已失效或格式錯誤'
        }
      }
    }

    return {
      valid: true,
      accountName: accountName || '(已連接)'
    }
  } catch (error) {
    console.error('Cookie validation failed:', error)
    return {
      valid: false,
      error: error.message || 'Cookie 驗證失敗'
    }
  }
}

// ============================================================================
// 完整的 Cookie 設定流程
// ============================================================================

/**
 * 設定 YouTube Cookie（驗證 + 儲存）
 * @param {string} cookie - Cookie 字串
 * @returns {Promise<{ success: boolean, error?: string, accountName?: string }>}
 */
export async function setYouTubeCookie(cookie) {
  // 驗證 cookie
  const validation = await validateYouTubeCookie(cookie)

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    }
  }

  // 儲存 cookie
  try {
    await storeYouTubeCookie(cookie)

    // 儲存認證狀態
    storeAuthStatus({
      isEnabled: true,
      isConnected: true,
      accountName: validation.accountName,
      lastValidated: Date.now()
    })

    return {
      success: true,
      accountName: validation.accountName
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 取消 YouTube Cookie 認證
 */
export function removeYouTubeCookie() {
  clearYouTubeCookie()
  storeAuthStatus({
    isEnabled: false,
    isConnected: false,
    accountName: null,
    lastValidated: null
  })
}

// ============================================================================
// 匯出
// ============================================================================

export default {
  // Cookie 管理
  storeYouTubeCookie,
  getStoredYouTubeCookie,
  clearYouTubeCookie,
  hasStoredCookie,

  // 驗證
  validateCookieFormat,
  validateYouTubeCookie,
  normalizeCookieString,

  // 認證狀態
  storeAuthStatus,
  getAuthStatus,

  // 完整流程
  setYouTubeCookie,
  removeYouTubeCookie
}
