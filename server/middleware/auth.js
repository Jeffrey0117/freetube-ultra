/**
 * FreeTube Local API Server - Authentication Middleware
 * API 認證中間件 - 處理 JWT Token 驗證
 * @module server/middleware/auth
 */

'use strict'

const crypto = require('crypto')
const { errorResponse } = require('../utils/response')
const { userService } = require('../services/userService')

// === JWT 設定 ===
// 使用環境變數或生成隨機密鑰（生產環境應使用固定密鑰）
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
const JWT_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 天（毫秒）

// 記憶體中的 token 黑名單（用於登出）
const tokenBlacklist = new Set()

/**
 * Base64 URL 編碼
 * @param {string|Buffer} data - 要編碼的資料
 * @returns {string} - Base64 URL 編碼結果
 */
function base64UrlEncode(data) {
  const str = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64')
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Base64 URL 解碼
 * @param {string} str - Base64 URL 編碼字串
 * @returns {string} - 解碼結果
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  // 補齊 padding
  while (str.length % 4) {
    str += '='
  }
  return Buffer.from(str, 'base64').toString('utf-8')
}

/**
 * 生成 JWT Token（簡化版，使用 HMAC-SHA256 簽名）
 * @param {Object} payload - Token 載荷
 * @param {string} payload.userId - 用戶 ID
 * @param {string} payload.username - 用戶名
 * @returns {string} - JWT Token
 */
function generateToken(payload) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const now = Date.now()
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY
  }

  // 編碼 header 和 payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload))

  // 建立簽名
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest()

  const encodedSignature = base64UrlEncode(signature)

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

/**
 * 驗證並解析 JWT Token
 * @param {string} token - JWT Token
 * @returns {Object|null} - 解析後的 payload 或 null
 */
function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return null
    }

    // 檢查黑名單
    if (tokenBlacklist.has(token)) {
      console.log('[Auth] Token is blacklisted')
      return null
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts

    // 驗證簽名
    const signatureInput = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signatureInput)
      .digest()

    const expectedEncodedSignature = base64UrlEncode(expectedSignature)

    // 使用時間安全比較
    if (!crypto.timingSafeEqual(
      Buffer.from(encodedSignature),
      Buffer.from(expectedEncodedSignature)
    )) {
      console.log('[Auth] Invalid token signature')
      return null
    }

    // 解析 payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload))

    // 檢查過期時間
    if (payload.exp && payload.exp < Date.now()) {
      console.log('[Auth] Token expired')
      return null
    }

    return payload
  } catch (err) {
    console.error('[Auth] Token verification error:', err.message)
    return null
  }
}

/**
 * 將 token 加入黑名單（用於登出）
 * @param {string} token - 要加入黑名單的 token
 */
function invalidateToken(token) {
  if (token) {
    tokenBlacklist.add(token)
    console.log('[Auth] Token invalidated')
  }
}

/**
 * 從請求標頭中提取 token
 * @param {import('http').IncomingMessage} req - HTTP 請求物件
 * @returns {string|null} - Token 或 null
 */
function extractToken(req) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return null
  }

  // 支援 "Bearer <token>" 格式
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return authHeader
}

/**
 * 認證中間件 - 驗證 Token 並附加用戶資訊到請求
 * @param {import('http').IncomingMessage} req - HTTP 請求物件
 * @param {import('http').ServerResponse} res - HTTP 回應物件
 * @param {Function} next - 下一個中間件
 * @returns {void}
 */
function authenticateToken(req, res, next) {
  const token = extractToken(req)

  if (!token) {
    return errorResponse(res, 401, '未提供認證 Token')
  }

  const payload = verifyToken(token)

  if (!payload) {
    return errorResponse(res, 401, 'Token 無效或已過期')
  }

  // 驗證用戶是否仍存在
  const user = userService.findById(payload.userId)

  if (!user) {
    return errorResponse(res, 401, '用戶不存在')
  }

  // 將用戶資訊和 token 附加到請求物件
  req.user = user
  req.token = token

  next()
}

/**
 * 可選認證中間件 - 有 Token 就驗證，沒有也放行
 * @param {import('http').IncomingMessage} req - HTTP 請求物件
 * @param {import('http').ServerResponse} res - HTTP 回應物件
 * @param {Function} next - 下一個中間件
 * @returns {void}
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req)

  if (token) {
    const payload = verifyToken(token)

    if (payload) {
      const user = userService.findById(payload.userId)
      if (user) {
        req.user = user
        req.token = token
      }
    }
  }

  // 無論是否有有效 token，都繼續執行
  next()
}

/**
 * 清理過期的黑名單 token（定期執行以釋放記憶體）
 * 注意：此簡化版本無法判斷 token 是否過期，
 * 建議在生產環境使用 Redis 並設定 TTL
 */
function cleanupBlacklist() {
  // 簡化版：限制黑名單大小
  if (tokenBlacklist.size > 10000) {
    // 清空舊的 token（簡化處理）
    const tokensArray = Array.from(tokenBlacklist)
    const toRemove = tokensArray.slice(0, 5000)
    toRemove.forEach(t => tokenBlacklist.delete(t))
    console.log('[Auth] Cleaned up blacklist, removed', toRemove.length, 'tokens')
  }
}

// 每小時清理一次黑名單
setInterval(cleanupBlacklist, 60 * 60 * 1000)

module.exports = {
  generateToken,
  verifyToken,
  invalidateToken,
  extractToken,
  authenticateToken,
  optionalAuth,
  // 匯出常數供測試使用
  JWT_EXPIRY
}
