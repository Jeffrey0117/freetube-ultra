/**
 * FreeTube Local API Server - Authentication Routes Tests
 * 認證 API 路由測試
 *
 * 執行方式:
 *   # 先啟動 API server
 *   node local-api-server.js &
 *
 *   # 執行測試
 *   node server/routes/auth.test.js
 *
 * @module server/routes/auth.test
 */

'use strict'

const http = require('http')

// === 測試設定 ===
const API_HOST = 'localhost'
const API_PORT = 3001
const BASE_PATH = '/api/v1/auth'

// 測試結果收集
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
}

// 測試用的隨機字串生成器（避免用戶名衝突）
function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// === HTTP 請求工具 ===

/**
 * 發送 HTTP 請求
 * @param {string} method - HTTP 方法
 * @param {string} path - 請求路徑
 * @param {Object} [body] - 請求內容
 * @param {Object} [headers] - 額外的請求標頭
 * @returns {Promise<{statusCode: number, headers: Object, body: Object|null}>}
 */
function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000
    }

    const req = http.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsedBody = null
        try {
          parsedBody = data ? JSON.parse(data) : null
        } catch (e) {
          // 無法解析 JSON 時保持 null
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody
        })
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

// 快捷方法
const GET = (path, headers) => httpRequest('GET', path, null, headers)
const POST = (path, body, headers) => httpRequest('POST', path, body, headers)
const PUT = (path, body, headers) => httpRequest('PUT', path, body, headers)
const DELETE = (path, headers) => httpRequest('DELETE', path, null, headers)

// === 測試工具函數 ===

function describe(name, fn) {
  console.log(`\n=== ${name} ===`)
  fn()
}

async function test(name, fn) {
  try {
    await fn()
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    console.log(`  [PASS] ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    console.log(`  [FAIL] ${name}`)
    console.log(`         Error: ${error.message}`)
  }
}

function skip(name, reason = '') {
  results.skipped++
  results.tests.push({ name, status: 'SKIP', reason })
  console.log(`  [SKIP] ${name}${reason ? ` (${reason})` : ''}`)
}

// === 斷言函數 ===

function assertEqual(actual, expected, message = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: 預期 ${JSON.stringify(expected)}，實際得到 ${JSON.stringify(actual)}`)
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(message || '預期為 true 但得到 false')
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(message || '預期為 false 但得到 true')
  }
}

function assertHasProperty(obj, prop, message = '') {
  if (!obj || typeof obj !== 'object' || !(prop in obj)) {
    throw new Error(message || `預期物件包含屬性 "${prop}"`)
  }
}

function assertNotHasProperty(obj, prop, message = '') {
  if (obj && typeof obj === 'object' && prop in obj) {
    throw new Error(message || `預期物件不包含屬性 "${prop}"`)
  }
}

function assertIsArray(value, message = '') {
  if (!Array.isArray(value)) {
    throw new Error(message || `預期為陣列但得到 ${typeof value}`)
  }
}

// === 測試輔助函數 ===

/**
 * 建立測試用戶並返回用戶資料和 token
 * @returns {Promise<{user: Object, token: string, password: string, username: string}>}
 */
async function createTestUser() {
  const username = `testuser_${randomString(8)}`
  const password = 'test123456'
  const displayName = 'Test User'

  // 註冊用戶
  await POST(`${BASE_PATH}/register`, { username, password, displayName })

  // 登入取得 token
  const loginRes = await POST(`${BASE_PATH}/login`, { username, password })

  return {
    user: loginRes.body?.user,
    token: loginRes.body?.token,
    password,
    username
  }
}

/**
 * 帶有認證的請求
 * @param {string} method - HTTP 方法
 * @param {string} path - 請求路徑
 * @param {Object} body - 請求內容
 * @param {string} token - JWT Token
 */
function authRequest(method, path, body, token) {
  const headers = { Authorization: `Bearer ${token}` }
  return httpRequest(method, path, body, headers)
}

// === 測試套件 ===

/**
 * POST /api/v1/auth/register 測試
 */
async function testRegister() {
  describe('POST /api/v1/auth/register', async () => {
    // 測試 1: 有效資料應成功註冊
    await test('有效資料應成功註冊', async () => {
      const username = `newuser_${randomString(8)}`
      const res = await POST(`${BASE_PATH}/register`, {
        username,
        password: 'password123',
        displayName: '新用戶'
      })

      assertEqual(res.statusCode, 201, '狀態碼應為 201')
      assertTrue(res.body?.success, '應返回 success: true')
      assertHasProperty(res.body, 'user', '應返回用戶資料')
      assertEqual(res.body.user.username, username, '用戶名應匹配')
    })

    // 測試 2: 缺少 username 應返回 400
    await test('缺少 username 應返回 400', async () => {
      const res = await POST(`${BASE_PATH}/register`, {
        password: 'password123'
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
      assertTrue(res.body?.error || res.body?.message, '應返回錯誤訊息')
    })

    // 測試 3: 缺少 password 應返回 400
    await test('缺少 password 應返回 400', async () => {
      const res = await POST(`${BASE_PATH}/register`, {
        username: `user_${randomString(8)}`
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
      assertTrue(res.body?.error || res.body?.message, '應返回錯誤訊息')
    })

    // 測試 4: 用戶名已存在應返回 400 (userService 拋出錯誤，auth.js 以 400 回應)
    await test('用戶名已存在應返回 400', async () => {
      const username = `existing_${randomString(8)}`

      // 先註冊一次
      await POST(`${BASE_PATH}/register`, {
        username,
        password: 'password123'
      })

      // 再次嘗試註冊相同用戶名
      const res = await POST(`${BASE_PATH}/register`, {
        username,
        password: 'different123'
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 5: 無效用戶名格式應返回 400
    await test('無效用戶名格式應返回 400 (包含特殊字元)', async () => {
      const res = await POST(`${BASE_PATH}/register`, {
        username: 'invalid@user!',
        password: 'password123'
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 6: 用戶名太短應返回 400
    await test('用戶名太短應返回 400', async () => {
      const res = await POST(`${BASE_PATH}/register`, {
        username: 'ab',
        password: 'password123'
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 7: 密碼太短應返回 400
    await test('密碼太短應返回 400', async () => {
      const res = await POST(`${BASE_PATH}/register`, {
        username: `user_${randomString(8)}`,
        password: '12345'  // 少於 6 字元
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 8: 成功註冊應返回用戶資料
    await test('成功註冊應返回用戶資料（不含密碼）', async () => {
      const username = `user_${randomString(8)}`
      const res = await POST(`${BASE_PATH}/register`, {
        username,
        password: 'password123',
        displayName: 'Display Name'
      })

      assertEqual(res.statusCode, 201, '狀態碼應為 201')
      assertHasProperty(res.body.user, '_id', '應有 _id')
      assertHasProperty(res.body.user, 'username', '應有 username')
      assertHasProperty(res.body.user, 'displayName', '應有 displayName')
      assertNotHasProperty(res.body.user, 'passwordHash', '不應包含 passwordHash')
      assertNotHasProperty(res.body.user, 'passwordSalt', '不應包含 passwordSalt')
    })

    // 測試 9: 用戶名應自動轉為小寫
    await test('用戶名應自動轉為小寫', async () => {
      const res = await POST(`${BASE_PATH}/register`, {
        username: `UPPERCASE_${randomString(6)}`,
        password: 'password123'
      })

      assertEqual(res.statusCode, 201, '狀態碼應為 201')
      assertTrue(
        res.body.user.username === res.body.user.username.toLowerCase(),
        '用戶名應為小寫'
      )
    })
  })
}

/**
 * POST /api/v1/auth/login 測試
 */
async function testLogin() {
  describe('POST /api/v1/auth/login', async () => {
    // 先建立一個測試用戶
    const username = `logintest_${randomString(8)}`
    const password = 'testpassword123'

    await POST(`${BASE_PATH}/register`, { username, password })

    // 測試 1: 正確帳密應成功登入
    await test('正確帳密應成功登入', async () => {
      const res = await POST(`${BASE_PATH}/login`, { username, password })

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
      assertHasProperty(res.body, 'user', '應返回用戶資料')
      assertHasProperty(res.body, 'token', '應返回 token')
    })

    // 測試 2: 錯誤密碼應返回 401
    await test('錯誤密碼應返回 401', async () => {
      const res = await POST(`${BASE_PATH}/login`, {
        username,
        password: 'wrongpassword'
      })

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 3: 不存在的用戶應返回 401
    await test('不存在的用戶應返回 401', async () => {
      const res = await POST(`${BASE_PATH}/login`, {
        username: `nonexistent_${randomString(12)}`,
        password: 'anypassword'
      })

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 4: 缺少 username 應返回 400
    await test('缺少 username 應返回 400', async () => {
      const res = await POST(`${BASE_PATH}/login`, {
        password: 'somepassword'
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 5: 缺少 password 應返回 400
    await test('缺少 password 應返回 400', async () => {
      const res = await POST(`${BASE_PATH}/login`, {
        username: 'someuser'
      })

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 6: 成功登入應返回 token
    await test('成功登入應返回有效的 JWT token', async () => {
      const res = await POST(`${BASE_PATH}/login`, { username, password })

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(typeof res.body.token === 'string', 'token 應為字串')
      assertTrue(res.body.token.split('.').length === 3, 'token 應為有效 JWT 格式')
    })

    // 測試 7: 登入回應不應包含密碼
    await test('登入回應不應包含密碼', async () => {
      const res = await POST(`${BASE_PATH}/login`, { username, password })

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertNotHasProperty(res.body.user, 'passwordHash', '不應包含 passwordHash')
      assertNotHasProperty(res.body.user, 'passwordSalt', '不應包含 passwordSalt')
    })

    // 測試 8: 用戶名不區分大小寫
    await test('用戶名不區分大小寫', async () => {
      const res = await POST(`${BASE_PATH}/login`, {
        username: username.toUpperCase(),
        password
      })

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
    })
  })
}

/**
 * POST /api/v1/auth/logout 測試
 */
async function testLogout() {
  describe('POST /api/v1/auth/logout', async () => {
    // 測試 1: 有效 token 應成功登出
    await test('有效 token 應成功登出', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('POST', `${BASE_PATH}/logout`, null, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
    })

    // 測試 2: 無效 token 應返回 401
    await test('無效 token 應返回 401', async () => {
      const res = await authRequest('POST', `${BASE_PATH}/logout`, null, 'invalid.token.here')

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 3: 缺少 token 應返回 401
    await test('缺少 token 應返回 401', async () => {
      const res = await POST(`${BASE_PATH}/logout`, null)

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 4: 登出後 token 應失效
    await test('登出後 token 應失效', async () => {
      const { token } = await createTestUser()

      // 先登出
      const logoutRes = await authRequest('POST', `${BASE_PATH}/logout`, null, token)
      assertEqual(logoutRes.statusCode, 200, '登出應成功')

      // 嘗試使用已登出的 token
      const meRes = await authRequest('GET', `${BASE_PATH}/me`, null, token)
      assertEqual(meRes.statusCode, 401, '已登出的 token 應無效')
    })

    // 測試 5: 登出後應返回成功訊息
    await test('登出後應返回成功訊息', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('POST', `${BASE_PATH}/logout`, null, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertHasProperty(res.body, 'message', '應有 message 屬性')
    })
  })
}

/**
 * GET /api/v1/auth/me 測試
 */
async function testMe() {
  describe('GET /api/v1/auth/me', async () => {
    // 測試 1: 有效 token 應返回用戶資料
    await test('有效 token 應返回用戶資料', async () => {
      const { token, username } = await createTestUser()

      const res = await authRequest('GET', `${BASE_PATH}/me`, null, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
      assertHasProperty(res.body, 'user', '應返回用戶資料')
      assertEqual(res.body.user.username, username, '用戶名應匹配')
    })

    // 測試 2: 無效 token 應返回 401
    await test('無效 token 應返回 401', async () => {
      const res = await authRequest('GET', `${BASE_PATH}/me`, null, 'invalid.jwt.token')

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 3: 過期 token 應返回 401
    await test('過期 token 應返回 401', async () => {
      // 建立一個手動構造的過期 token（這是模擬測試）
      // 實際的過期 token 測試需要等待或修改伺服器設定
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwidXNlcm5hbWUiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid_signature'

      const res = await authRequest('GET', `${BASE_PATH}/me`, null, expiredToken)

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 4: 返回資料不應包含密碼
    await test('返回資料不應包含密碼', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('GET', `${BASE_PATH}/me`, null, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertNotHasProperty(res.body.user, 'passwordHash', '不應包含 passwordHash')
      assertNotHasProperty(res.body.user, 'passwordSalt', '不應包含 passwordSalt')
    })

    // 測試 5: 應返回完整的用戶資訊
    await test('應返回完整的用戶資訊', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('GET', `${BASE_PATH}/me`, null, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertHasProperty(res.body.user, '_id', '應有 _id')
      assertHasProperty(res.body.user, 'username', '應有 username')
      assertHasProperty(res.body.user, 'displayName', '應有 displayName')
      assertHasProperty(res.body.user, 'avatar', '應有 avatar')
      assertHasProperty(res.body.user, 'createdAt', '應有 createdAt')
    })

    // 測試 6: 缺少 Authorization 標頭應返回 401
    await test('缺少 Authorization 標頭應返回 401', async () => {
      const res = await GET(`${BASE_PATH}/me`)

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })
  })
}

/**
 * PUT /api/v1/auth/profile 測試
 */
async function testProfile() {
  describe('PUT /api/v1/auth/profile', async () => {
    // 測試 1: 更新 displayName 應成功
    await test('更新 displayName 應成功', async () => {
      const { token } = await createTestUser()
      const newDisplayName = '更新後的名稱'

      const res = await authRequest('PUT', `${BASE_PATH}/profile`, {
        displayName: newDisplayName
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
      assertEqual(res.body.user.displayName, newDisplayName, 'displayName 應已更新')
    })

    // 測試 2: 更新 avatar 應成功
    await test('更新 avatar 應成功', async () => {
      const { token } = await createTestUser()
      const newAvatar = 'https://example.com/avatar.jpg'

      const res = await authRequest('PUT', `${BASE_PATH}/profile`, {
        avatar: newAvatar
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertEqual(res.body.user.avatar, newAvatar, 'avatar 應已更新')
    })

    // 測試 3: 無效 token 應返回 401
    await test('無效 token 應返回 401', async () => {
      const res = await authRequest('PUT', `${BASE_PATH}/profile`, {
        displayName: 'New Name'
      }, 'invalid.token')

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 4: 空 body 應仍然返回成功（保持原值）
    await test('空 body 應仍然返回成功（保持原值）', async () => {
      const { token, user } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/profile`, {}, token)

      // 空 body 更新也應該成功，只是不更改任何值
      assertEqual(res.statusCode, 200, '狀態碼應為 200')
    })

    // 測試 5: 同時更新多個欄位
    await test('同時更新 displayName 和 avatar', async () => {
      const { token } = await createTestUser()
      const newDisplayName = '同時更新測試'
      const newAvatar = 'https://example.com/new-avatar.png'

      const res = await authRequest('PUT', `${BASE_PATH}/profile`, {
        displayName: newDisplayName,
        avatar: newAvatar
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertEqual(res.body.user.displayName, newDisplayName, 'displayName 應已更新')
      assertEqual(res.body.user.avatar, newAvatar, 'avatar 應已更新')
    })

    // 測試 6: 更新後不應包含密碼資訊
    await test('更新後不應包含密碼資訊', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/profile`, {
        displayName: 'No Password Test'
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertNotHasProperty(res.body.user, 'passwordHash', '不應包含 passwordHash')
      assertNotHasProperty(res.body.user, 'passwordSalt', '不應包含 passwordSalt')
    })
  })
}

/**
 * DELETE /api/v1/auth/account 測試
 */
async function testDeleteAccount() {
  describe('DELETE /api/v1/auth/account', async () => {
    // 測試 1: 有效 token 應成功刪除帳戶
    await test('有效 token 應成功刪除帳戶', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('DELETE', `${BASE_PATH}/account`, null, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
    })

    // 測試 2: 刪除後 token 應失效
    await test('刪除後 token 應失效', async () => {
      const { token } = await createTestUser()

      // 刪除帳戶
      const deleteRes = await authRequest('DELETE', `${BASE_PATH}/account`, null, token)
      assertEqual(deleteRes.statusCode, 200, '刪除應成功')

      // 嘗試使用已刪除帳戶的 token
      const meRes = await authRequest('GET', `${BASE_PATH}/me`, null, token)
      assertEqual(meRes.statusCode, 401, '已刪除帳戶的 token 應無效')
    })

    // 測試 3: 無效 token 應返回 401
    await test('無效 token 應返回 401', async () => {
      const res = await authRequest('DELETE', `${BASE_PATH}/account`, null, 'invalid.token')

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 4: 刪除後無法再次登入
    await test('刪除後無法再次登入', async () => {
      const username = `todelete_${randomString(8)}`
      const password = 'password123'

      // 註冊
      await POST(`${BASE_PATH}/register`, { username, password })

      // 登入
      const loginRes = await POST(`${BASE_PATH}/login`, { username, password })
      const token = loginRes.body.token

      // 刪除
      await authRequest('DELETE', `${BASE_PATH}/account`, null, token)

      // 嘗試再次登入
      const reloginRes = await POST(`${BASE_PATH}/login`, { username, password })
      assertEqual(reloginRes.statusCode, 401, '已刪除的用戶不應能登入')
    })

    // 測試 5: 刪除應返回確認訊息
    await test('刪除應返回確認訊息', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('DELETE', `${BASE_PATH}/account`, null, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertHasProperty(res.body, 'message', '應有 message 屬性')
    })
  })
}

/**
 * GET /api/v1/auth/users 測試
 */
async function testGetUsers() {
  describe('GET /api/v1/auth/users', async () => {
    // 測試 1: 應返回所有用戶列表
    await test('應返回所有用戶列表', async () => {
      // 先建立幾個測試用戶
      await createTestUser()
      await createTestUser()

      const res = await GET(`${BASE_PATH}/users`)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
      assertHasProperty(res.body, 'users', '應返回 users 陣列')
      assertIsArray(res.body.users, 'users 應為陣列')
    })

    // 測試 2: 返回資料不應包含密碼
    await test('返回資料不應包含密碼', async () => {
      const res = await GET(`${BASE_PATH}/users`)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')

      if (res.body.users.length > 0) {
        const user = res.body.users[0]
        assertNotHasProperty(user, 'passwordHash', '不應包含 passwordHash')
        assertNotHasProperty(user, 'passwordSalt', '不應包含 passwordSalt')
      }
    })

    // 測試 3: 用戶列表應包含基本資訊
    await test('用戶列表應包含基本資訊', async () => {
      await createTestUser()

      const res = await GET(`${BASE_PATH}/users`)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')

      if (res.body.users.length > 0) {
        const user = res.body.users[0]
        assertHasProperty(user, '_id', '應有 _id')
        assertHasProperty(user, 'username', '應有 username')
        assertHasProperty(user, 'displayName', '應有 displayName')
        assertHasProperty(user, 'avatar', '應有 avatar')
      }
    })

    // 測試 4: 不需要認證即可獲取用戶列表
    await test('不需要認證即可獲取用戶列表', async () => {
      const res = await GET(`${BASE_PATH}/users`)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      // 這個端點是公開的，用於切換帳戶功能
    })

    // 測試 5: 新註冊用戶應出現在列表中
    await test('新註冊用戶應出現在列表中', async () => {
      const username = `listtest_${randomString(8)}`
      await POST(`${BASE_PATH}/register`, {
        username,
        password: 'password123'
      })

      const res = await GET(`${BASE_PATH}/users`)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      const found = res.body.users.some(u => u.username === username)
      assertTrue(found, '新註冊用戶應出現在列表中')
    })
  })
}

/**
 * PUT /api/v1/auth/password 測試
 */
async function testChangePassword() {
  describe('PUT /api/v1/auth/password', async () => {
    // 測試 1: 正確舊密碼應成功變更
    await test('正確舊密碼應成功變更', async () => {
      const { token, password } = await createTestUser()
      const newPassword = 'newpassword456'

      const res = await authRequest('PUT', `${BASE_PATH}/password`, {
        currentPassword: password,
        newPassword: newPassword
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
    })

    // 測試 2: 錯誤舊密碼應返回 400 (userService 拋出錯誤)
    await test('錯誤舊密碼應返回 400', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/password`, {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword456'
      }, token)

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 3: 新密碼太短應返回 400
    await test('新密碼太短應返回 400', async () => {
      const { token, password } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/password`, {
        currentPassword: password,
        newPassword: '12345'  // 少於 6 字元
      }, token)

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 4: 無效 token 應返回 401
    await test('無效 token 應返回 401', async () => {
      const res = await authRequest('PUT', `${BASE_PATH}/password`, {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword456'
      }, 'invalid.token')

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 5: 變更後應能使用新密碼登入
    await test('變更後應能使用新密碼登入', async () => {
      const { token, password, username } = await createTestUser()
      const newPassword = 'brandnewpwd789'

      // 變更密碼
      const changeRes = await authRequest('PUT', `${BASE_PATH}/password`, {
        currentPassword: password,
        newPassword: newPassword
      }, token)
      assertEqual(changeRes.statusCode, 200, '密碼變更應成功')

      // 使用新密碼登入
      const loginRes = await POST(`${BASE_PATH}/login`, {
        username,
        password: newPassword
      })
      assertEqual(loginRes.statusCode, 200, '應能使用新密碼登入')
    })

    // 測試 6: 變更後應無法使用舊密碼登入
    await test('變更後應無法使用舊密碼登入', async () => {
      const username = `pwdtest_${randomString(8)}`
      const oldPassword = 'oldpassword123'
      const newPassword = 'newpassword456'

      // 註冊
      await POST(`${BASE_PATH}/register`, {
        username,
        password: oldPassword
      })

      // 登入取得 token
      const loginRes = await POST(`${BASE_PATH}/login`, {
        username,
        password: oldPassword
      })
      const token = loginRes.body.token

      // 變更密碼
      await authRequest('PUT', `${BASE_PATH}/password`, {
        currentPassword: oldPassword,
        newPassword: newPassword
      }, token)

      // 嘗試使用舊密碼登入
      const oldPwdRes = await POST(`${BASE_PATH}/login`, {
        username,
        password: oldPassword
      })
      assertEqual(oldPwdRes.statusCode, 401, '舊密碼應無法登入')
    })

    // 測試 7: 缺少 currentPassword 應返回 400
    await test('缺少 currentPassword 應返回 400', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/password`, {
        newPassword: 'newpassword456'
      }, token)

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })

    // 測試 8: 缺少 newPassword 應返回 400
    await test('缺少 newPassword 應返回 400', async () => {
      const { token, password } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/password`, {
        currentPassword: password
      }, token)

      assertEqual(res.statusCode, 400, '狀態碼應為 400')
    })
  })
}

/**
 * PUT /api/v1/auth/stats 測試 (額外測試)
 */
async function testUpdateStats() {
  describe('PUT /api/v1/auth/stats', async () => {
    // 測試 1: 更新觀看統計應成功
    await test('更新觀看統計應成功', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/stats`, {
        watchCount: 5,
        watchTimeSeconds: 3600
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertTrue(res.body?.success, '應返回 success: true')
    })

    // 測試 2: 無效 token 應返回 401
    await test('無效 token 應返回 401', async () => {
      const res = await authRequest('PUT', `${BASE_PATH}/stats`, {
        watchCount: 1
      }, 'invalid.token')

      assertEqual(res.statusCode, 401, '狀態碼應為 401')
    })

    // 測試 3: 更新 favoriteGenre 應成功
    await test('更新 favoriteGenre 應成功', async () => {
      const { token } = await createTestUser()

      const res = await authRequest('PUT', `${BASE_PATH}/stats`, {
        favoriteGenre: 'Music'
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
    })

    // 測試 4: 統計應累加
    await test('統計應累加', async () => {
      const { token } = await createTestUser()

      // 第一次更新
      await authRequest('PUT', `${BASE_PATH}/stats`, {
        watchCount: 5
      }, token)

      // 第二次更新
      const res = await authRequest('PUT', `${BASE_PATH}/stats`, {
        watchCount: 3
      }, token)

      assertEqual(res.statusCode, 200, '狀態碼應為 200')
      assertEqual(res.body.user.stats.watchCount, 8, '觀看次數應累加為 8')
    })
  })
}

// === 主測試執行 ===

async function runAllTests() {
  console.log('========================================')
  console.log('   FreeTube Auth API 測試')
  console.log('========================================')
  console.log(`API Server: http://${API_HOST}:${API_PORT}`)

  const startTime = Date.now()

  try {
    // 檢查伺服器是否運行
    console.log('\n[Setup] 檢查 API Server 是否運行...')
    try {
      await GET('/api/v1/stats')
      console.log('[Setup] API Server 連接成功')
    } catch (e) {
      console.error('[ERROR] 無法連接到 API Server')
      console.error('        請先執行: node local-api-server.js')
      process.exit(1)
    }

    // 執行所有測試套件
    await testRegister()
    await testLogin()
    await testLogout()
    await testMe()
    await testProfile()
    await testDeleteAccount()
    await testGetUsers()
    await testChangePassword()
    await testUpdateStats()

  } catch (error) {
    console.error('\n[ERROR] 測試執行失敗:', error.message)
    results.failed++
    results.tests.push({ name: 'Test Execution', status: 'FAIL', error: error.message })
  }

  const duration = Date.now() - startTime

  // 輸出結果摘要
  console.log('\n========================================')
  console.log('           測試結果')
  console.log('========================================')
  console.log(`  通過:   ${results.passed}`)
  console.log(`  失敗:   ${results.failed}`)
  console.log(`  跳過:   ${results.skipped}`)
  console.log(`  總計:   ${results.passed + results.failed + results.skipped}`)
  console.log(`  耗時:   ${duration}ms`)
  console.log('========================================')

  if (results.failed > 0) {
    console.log('\n失敗的測試:')
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`))
    process.exit(1)
  } else {
    console.log('\n所有測試通過!')
    process.exit(0)
  }
}

// 匯出測試函數和工具
module.exports = {
  runAllTests,
  results,
  // 匯出測試工具供其他測試使用
  httpRequest,
  GET,
  POST,
  PUT,
  DELETE,
  authRequest,
  createTestUser,
  randomString,
  // 斷言函數
  assertEqual,
  assertTrue,
  assertFalse,
  assertHasProperty,
  assertNotHasProperty,
  assertIsArray
}

// 直接執行
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('測試執行失敗:', error)
    process.exit(1)
  })
}
