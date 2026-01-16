/**
 * FreeTube Local API Server - Authentication Routes
 * 認證 API 路由
 * @module server/routes/auth
 */

'use strict'

const { successResponse, errorResponse } = require('../utils/response')
const { userService } = require('../services/userService')
const { generateToken, invalidateToken, authenticateToken } = require('../middleware/auth')

/**
 * 解析請求 body（JSON 格式）
 * @param {import('http').IncomingMessage} req - HTTP 請求物件
 * @returns {Promise<Object>} - 解析後的 JSON 物件
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      // 限制 body 大小為 1MB
      if (body.length > 1024 * 1024) {
        reject(new Error('請求內容過大'))
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(new Error('無效的 JSON 格式'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * 處理認證相關的 API 請求
 * @param {Object} context - 請求上下文
 * @param {import('http').IncomingMessage} context.req - HTTP 請求物件
 * @param {import('http').ServerResponse} context.res - HTTP 回應物件
 * @param {string} context.path - 請求路徑
 * @param {string} context.method - 請求方法
 * @returns {Promise<boolean>} - 是否已處理請求
 */
async function handleAuthRoutes(context) {
  const { req, res, path, method } = context

  // === POST /api/v1/auth/register - 註冊新用戶 ===
  if (path === '/api/v1/auth/register' && method === 'POST') {
    try {
      const body = await parseBody(req)
      const { username, password, displayName } = body

      if (!username || !password) {
        return errorResponse(res, 400, '用戶名和密碼為必填')
      }

      const user = await userService.register(username, password, displayName)

      console.log('[Auth] User registered:', username)
      return successResponse(res, {
        success: true,
        user
      }, 201)
    } catch (err) {
      console.error('[Auth] Registration error:', err.message)
      return errorResponse(res, 400, err.message)
    }
  }

  // === POST /api/v1/auth/login - 登入 ===
  if (path === '/api/v1/auth/login' && method === 'POST') {
    try {
      const body = await parseBody(req)
      const { username, password } = body

      if (!username || !password) {
        return errorResponse(res, 400, '用戶名和密碼為必填')
      }

      const user = await userService.login(username, password)

      // 生成 JWT Token
      const token = generateToken({
        userId: user._id,
        username: user.username
      })

      console.log('[Auth] User logged in:', username)
      return successResponse(res, {
        success: true,
        user,
        token
      })
    } catch (err) {
      console.error('[Auth] Login error:', err.message)
      return errorResponse(res, 401, err.message)
    }
  }

  // === POST /api/v1/auth/logout - 登出 ===
  if (path === '/api/v1/auth/logout' && method === 'POST') {
    // 使用認證中間件包裝
    return new Promise((resolve) => {
      authenticateToken(req, res, () => {
        // 將目前的 token 加入黑名單
        invalidateToken(req.token)

        console.log('[Auth] User logged out:', req.user.username)
        successResponse(res, {
          success: true,
          message: '已成功登出'
        })
        resolve(true)
      })
    })
  }

  // === GET /api/v1/auth/me - 取得當前用戶資訊 ===
  if (path === '/api/v1/auth/me' && method === 'GET') {
    return new Promise((resolve) => {
      authenticateToken(req, res, () => {
        successResponse(res, {
          success: true,
          user: req.user
        })
        resolve(true)
      })
    })
  }

  // === PUT /api/v1/auth/profile - 更新個人檔案 ===
  if (path === '/api/v1/auth/profile' && method === 'PUT') {
    return new Promise(async (resolve) => {
      authenticateToken(req, res, async () => {
        try {
          const body = await parseBody(req)
          const { displayName, avatar } = body

          const updatedUser = userService.updateProfile(req.user._id, {
            displayName,
            avatar
          })

          console.log('[Auth] Profile updated:', req.user.username)
          successResponse(res, {
            success: true,
            user: updatedUser
          })
          resolve(true)
        } catch (err) {
          console.error('[Auth] Profile update error:', err.message)
          errorResponse(res, 400, err.message)
          resolve(true)
        }
      })
    })
  }

  // === DELETE /api/v1/auth/account - 刪除帳戶 ===
  if (path === '/api/v1/auth/account' && method === 'DELETE') {
    return new Promise((resolve) => {
      authenticateToken(req, res, () => {
        try {
          const username = req.user.username
          userService.deleteAccount(req.user._id)

          // 將 token 加入黑名單
          invalidateToken(req.token)

          console.log('[Auth] Account deleted:', username)
          successResponse(res, {
            success: true,
            message: '帳戶已成功刪除'
          })
          resolve(true)
        } catch (err) {
          console.error('[Auth] Account deletion error:', err.message)
          errorResponse(res, 400, err.message)
          resolve(true)
        }
      })
    })
  }

  // === GET /api/v1/auth/users - 取得所有本地用戶（用於切換帳戶） ===
  if (path === '/api/v1/auth/users' && method === 'GET') {
    try {
      const users = userService.getAllUsers()

      return successResponse(res, {
        success: true,
        users
      })
    } catch (err) {
      console.error('[Auth] Get users error:', err.message)
      return errorResponse(res, 500, err.message)
    }
  }

  // === PUT /api/v1/auth/password - 變更密碼 ===
  if (path === '/api/v1/auth/password' && method === 'PUT') {
    return new Promise(async (resolve) => {
      authenticateToken(req, res, async () => {
        try {
          const body = await parseBody(req)
          const { currentPassword, newPassword } = body

          if (!currentPassword || !newPassword) {
            errorResponse(res, 400, '目前密碼和新密碼為必填')
            resolve(true)
            return
          }

          await userService.changePassword(req.user._id, currentPassword, newPassword)

          console.log('[Auth] Password changed:', req.user.username)
          successResponse(res, {
            success: true,
            message: '密碼已成功變更'
          })
          resolve(true)
        } catch (err) {
          console.error('[Auth] Password change error:', err.message)
          errorResponse(res, 400, err.message)
          resolve(true)
        }
      })
    })
  }

  // === PUT /api/v1/auth/stats - 更新用戶統計資料 ===
  if (path === '/api/v1/auth/stats' && method === 'PUT') {
    return new Promise(async (resolve) => {
      authenticateToken(req, res, async () => {
        try {
          const body = await parseBody(req)
          const { watchCount, watchTimeSeconds, favoriteGenre } = body

          const updatedUser = userService.updateStats(req.user._id, {
            watchCount,
            watchTimeSeconds,
            favoriteGenre
          })

          successResponse(res, {
            success: true,
            user: updatedUser
          })
          resolve(true)
        } catch (err) {
          console.error('[Auth] Stats update error:', err.message)
          errorResponse(res, 400, err.message)
          resolve(true)
        }
      })
    })
  }

  // 未匹配任何認證路由
  return false
}

module.exports = {
  handleAuthRoutes,
  parseBody
}
