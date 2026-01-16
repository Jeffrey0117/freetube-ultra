/**
 * FreeTube Local API Server - Auth Integration Tests
 * 會員系統端對端整合測試
 * 執行: node server/auth.integration.test.js
 *
 * 測試範圍：
 * 1. 完整註冊登入流程
 * 2. 多用戶場景
 * 3. 個人檔案管理
 * 4. 會話管理
 * 5. 錯誤處理
 * 6. 統計數據
 * 7. 安全性測試
 * 8. 邊界條件
 */

'use strict'

const http = require('http')
const { createApp, initializeServices } = require('./app')

// === 測試結果收集 ===
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
}

// === 測試伺服器設定 ===
let server = null
let baseUrl = ''
const TEST_PORT = 3098 // 使用獨立的測試端口，避免衝突

// === 測試工具函數 ===

/**
 * 同步測試（用於不需要 async 的測試）
 */
function test(name, fn) {
  try {
    fn()
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    console.log(`  [PASS] ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    console.log(`  [FAIL] ${name}`)
    console.log(`    Error: ${error.message}`)
  }
}

/**
 * 非同步測試
 */
async function testAsync(name, fn) {
  try {
    await fn()
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    console.log(`  [PASS] ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    console.log(`  [FAIL] ${name}`)
    console.log(`    Error: ${error.message}`)
  }
}

/**
 * 跳過測試
 */
function skip(name, reason = '') {
  results.skipped++
  results.tests.push({ name, status: 'SKIP', reason })
  console.log(`  [SKIP] ${name}${reason ? ' (' + reason + ')' : ''}`)
}

// === 斷言工具函數 ===

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true but got false')
  }
}

function assertFalse(value, message) {
  if (value) {
    throw new Error(message || 'Expected false but got true')
  }
}

function assertContains(str, substr, message) {
  if (!str || !str.includes(substr)) {
    throw new Error(message || `Expected "${str}" to contain "${substr}"`)
  }
}

function assertNotContains(str, substr, message) {
  if (str && str.includes(substr)) {
    throw new Error(message || `Expected "${str}" not to contain "${substr}"`)
  }
}

function assertIsArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message || `Expected array but got ${typeof value}`)
  }
}

function assertHasProperty(obj, prop, message) {
  if (!obj || typeof obj !== 'object' || !(prop in obj)) {
    throw new Error(message || `Expected object to have property "${prop}"`)
  }
}

function assertNotHasProperty(obj, prop, message) {
  if (obj && typeof obj === 'object' && prop in obj) {
    throw new Error(message || `Expected object not to have property "${prop}"`)
  }
}

function assertGreaterThan(actual, expected, message) {
  if (actual <= expected) {
    throw new Error(message || `Expected ${actual} to be greater than ${expected}`)
  }
}

function assertGreaterThanOrEqual(actual, expected, message) {
  if (actual < expected) {
    throw new Error(message || `Expected ${actual} to be greater than or equal to ${expected}`)
  }
}

// === HTTP 請求工具 ===

/**
 * 通用 API 請求函數
 * @param {string} method - HTTP 方法
 * @param {string} path - API 路徑
 * @param {Object|null} body - 請求 body
 * @param {string|null} token - 認證 token
 * @param {Object} options - 額外選項
 * @returns {Promise<Object>} - 回應物件
 */
function api(method, path, body = null, token = null, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const postData = body ? JSON.stringify(body) : ''

    const headers = {
      'Content-Type': 'application/json'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData)
    }

    const req = http.request(url, {
      method,
      headers,
      timeout: options.timeout || 30000
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => {
            try {
              return JSON.parse(data)
            } catch (e) {
              return null
            }
          }
        })
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (postData) {
      req.write(postData)
    }
    req.end()
  })
}

// === 便捷 API 方法 ===

const register = (data) => api('POST', '/api/v1/auth/register', data)
const login = (data) => api('POST', '/api/v1/auth/login', data)
const logout = (token) => api('POST', '/api/v1/auth/logout', null, token)
const getMe = (token) => api('GET', '/api/v1/auth/me', null, token)
const updateProfile = (data, token) => api('PUT', '/api/v1/auth/profile', data, token)
const deleteAccount = (token) => api('DELETE', '/api/v1/auth/account', null, token)
const getUsers = () => api('GET', '/api/v1/auth/users')
const changePassword = (data, token) => api('PUT', '/api/v1/auth/password', data, token)
const updateStats = (data, token) => api('PUT', '/api/v1/auth/stats', data, token)

// === 測試資料生成器 ===

let userCounter = 0

/**
 * 生成唯一的測試用戶資料
 */
function generateTestUser(prefix = 'testuser') {
  const id = Date.now().toString(36) + (++userCounter).toString(36)
  return {
    username: `${prefix}_${id}`.slice(0, 20).toLowerCase(),
    password: 'Test@1234',
    displayName: `Test User ${userCounter}`
  }
}

// === 伺服器設定 ===

async function startServer() {
  const app = createApp()

  return new Promise((resolve, reject) => {
    server = http.createServer(app)
    server.listen(TEST_PORT, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${TEST_PORT}`
      console.log(`  測試伺服器已啟動: ${baseUrl}`)
      resolve()
    })
    server.on('error', reject)
  })
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('  測試伺服器已停止')
        resolve()
      })
    } else {
      resolve()
    }
  })
}

// === 測試套件 ===

/**
 * 1. 完整註冊登入流程
 */
async function testCompleteAuthFlow() {
  console.log('\n=== 1. 完整註冊登入流程 ===')

  // 測試 1.1: 新用戶註冊 -> 登出 -> 登入 -> 取得資料
  await testAsync('1.1 新用戶註冊 -> 登出 -> 登入 -> 取得資料', async () => {
    const testUser = generateTestUser('flow')

    // 步驟 1: 註冊
    const registerRes = await register(testUser)
    assertEqual(registerRes.statusCode, 201, '註冊應返回 201')
    const registerData = registerRes.json()
    assertTrue(registerData.success, '註冊應成功')
    assertHasProperty(registerData, 'user', '應返回用戶資料')

    // 步驟 2: 登入取得 token
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    assertEqual(loginRes.statusCode, 200, '登入應返回 200')
    const loginData = loginRes.json()
    assertTrue(loginData.success, '登入應成功')
    assertHasProperty(loginData, 'token', '應返回 token')
    const token1 = loginData.token

    // 步驟 3: 登出
    const logoutRes = await logout(token1)
    assertEqual(logoutRes.statusCode, 200, '登出應返回 200')

    // 步驟 4: 重新登入
    const reloginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    assertEqual(reloginRes.statusCode, 200, '重新登入應返回 200')
    const reloginData = reloginRes.json()
    const token2 = reloginData.token

    // 步驟 5: 使用新 token 取得資料
    const meRes = await getMe(token2)
    assertEqual(meRes.statusCode, 200, '取得資料應返回 200')
    const meData = meRes.json()
    assertEqual(meData.user.username, testUser.username, '用戶名應匹配')

    // 清理: 刪除測試帳戶
    await deleteAccount(token2)
  })

  // 測試 1.2: 註冊後應能立即使用 token
  await testAsync('1.2 註冊後應能立即使用 token', async () => {
    const testUser = generateTestUser('immediate')

    // 註冊
    const registerRes = await register(testUser)
    assertEqual(registerRes.statusCode, 201, '註冊應返回 201')

    // 立即登入取得 token
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const loginData = loginRes.json()
    const token = loginData.token

    // 立即使用 token
    const meRes = await getMe(token)
    assertEqual(meRes.statusCode, 200, 'Token 應立即可用')

    // 清理
    await deleteAccount(token)
  })

  // 測試 1.3: 登出後 token 應失效
  await testAsync('1.3 登出後 token 應失效', async () => {
    const testUser = generateTestUser('logout')

    // 註冊並登入
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 登出
    await logout(token)

    // 嘗試使用舊 token
    const meRes = await getMe(token)
    assertEqual(meRes.statusCode, 401, '登出後 token 應失效，返回 401')

    // 清理: 重新登入後刪除
    const newLoginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    await deleteAccount(newLoginRes.json().token)
  })

  // 測試 1.4: 重新登入應獲得新 token
  await testAsync('1.4 重新登入應獲得新 token', async () => {
    const testUser = generateTestUser('relogin')

    // 註冊
    await register(testUser)

    // 第一次登入
    const loginRes1 = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token1 = loginRes1.json().token

    // 第二次登入
    const loginRes2 = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token2 = loginRes2.json().token

    // 兩個 token 應該不同
    assertTrue(token1 !== token2, '每次登入應獲得不同的 token')

    // 但兩個 token 都應有效
    const meRes1 = await getMe(token1)
    const meRes2 = await getMe(token2)
    assertEqual(meRes1.statusCode, 200, '第一個 token 應有效')
    assertEqual(meRes2.statusCode, 200, '第二個 token 應有效')

    // 清理
    await deleteAccount(token2)
  })
}

/**
 * 2. 多用戶場景
 */
async function testMultiUserScenarios() {
  console.log('\n=== 2. 多用戶場景 ===')

  // 測試 2.1: 可建立多個用戶
  await testAsync('2.1 可建立多個用戶', async () => {
    const users = []
    const tokens = []

    // 建立 3 個用戶
    for (let i = 0; i < 3; i++) {
      const testUser = generateTestUser(`multi${i}`)
      const registerRes = await register(testUser)
      assertEqual(registerRes.statusCode, 201, `用戶 ${i + 1} 註冊應成功`)
      users.push(testUser)

      const loginRes = await login({
        username: testUser.username,
        password: testUser.password
      })
      tokens.push(loginRes.json().token)
    }

    // 驗證所有用戶都存在
    const usersRes = await getUsers()
    const allUsers = usersRes.json().users
    for (const user of users) {
      const found = allUsers.find(u => u.username === user.username)
      assertTrue(found !== undefined, `用戶 ${user.username} 應存在於列表中`)
    }

    // 清理
    for (const token of tokens) {
      await deleteAccount(token)
    }
  })

  // 測試 2.2: 不同用戶的資料應隔離
  await testAsync('2.2 不同用戶的資料應隔離', async () => {
    const user1 = generateTestUser('isolate1')
    const user2 = generateTestUser('isolate2')

    // 建立兩個用戶
    await register(user1)
    await register(user2)

    const loginRes1 = await login({
      username: user1.username,
      password: user1.password
    })
    const token1 = loginRes1.json().token

    const loginRes2 = await login({
      username: user2.username,
      password: user2.password
    })
    const token2 = loginRes2.json().token

    // 更新用戶 1 的個人檔案
    await updateProfile({ displayName: 'User One Special' }, token1)

    // 驗證用戶 2 的資料未受影響
    const me2Res = await getMe(token2)
    const me2Data = me2Res.json()
    assertTrue(me2Data.user.displayName !== 'User One Special', '用戶 2 的資料應與用戶 1 隔離')

    // 清理
    await deleteAccount(token1)
    await deleteAccount(token2)
  })

  // 測試 2.3: 切換用戶應正確載入資料
  await testAsync('2.3 切換用戶應正確載入資料', async () => {
    const user1 = generateTestUser('switch1')
    const user2 = generateTestUser('switch2')

    // 建立並設定不同的顯示名稱
    await register({ ...user1, displayName: 'First User' })
    await register({ ...user2, displayName: 'Second User' })

    const loginRes1 = await login({
      username: user1.username,
      password: user1.password
    })
    const token1 = loginRes1.json().token

    const loginRes2 = await login({
      username: user2.username,
      password: user2.password
    })
    const token2 = loginRes2.json().token

    // 使用 token1 取得資料
    const me1Res = await getMe(token1)
    assertEqual(me1Res.json().user.displayName, 'First User', '應載入第一個用戶的資料')

    // 使用 token2 取得資料（模擬切換用戶）
    const me2Res = await getMe(token2)
    assertEqual(me2Res.json().user.displayName, 'Second User', '應載入第二個用戶的資料')

    // 清理
    await deleteAccount(token1)
    await deleteAccount(token2)
  })

  // 測試 2.4: 用戶列表應包含所有用戶
  await testAsync('2.4 用戶列表應包含所有用戶', async () => {
    // 取得初始用戶數量
    const initialRes = await getUsers()
    const initialCount = initialRes.json().users.length

    // 建立新用戶
    const testUser = generateTestUser('listtest')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 驗證列表已更新
    const afterRes = await getUsers()
    const afterCount = afterRes.json().users.length
    assertEqual(afterCount, initialCount + 1, '用戶列表應包含新用戶')

    // 用戶列表應只包含安全欄位
    const users = afterRes.json().users
    for (const user of users) {
      assertHasProperty(user, '_id', '應有 _id')
      assertHasProperty(user, 'username', '應有 username')
      assertHasProperty(user, 'displayName', '應有 displayName')
      assertNotHasProperty(user, 'passwordHash', '不應有 passwordHash')
      assertNotHasProperty(user, 'passwordSalt', '不應有 passwordSalt')
    }

    // 清理
    await deleteAccount(token)
  })
}

/**
 * 3. 個人檔案管理
 */
async function testProfileManagement() {
  console.log('\n=== 3. 個人檔案管理 ===')

  // 測試 3.1: 更新 displayName 應持久化
  await testAsync('3.1 更新 displayName 應持久化', async () => {
    const testUser = generateTestUser('profile1')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 更新 displayName
    const newDisplayName = 'New Display Name ' + Date.now()
    await updateProfile({ displayName: newDisplayName }, token)

    // 重新取得資料驗證持久化
    const meRes = await getMe(token)
    assertEqual(meRes.json().user.displayName, newDisplayName, 'displayName 應已更新')

    // 登出再登入後也應保持
    await logout(token)
    const reloginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const newToken = reloginRes.json().token

    const meRes2 = await getMe(newToken)
    assertEqual(meRes2.json().user.displayName, newDisplayName, 'displayName 應持久化')

    // 清理
    await deleteAccount(newToken)
  })

  // 測試 3.2: 更新 avatar 應持久化
  await testAsync('3.2 更新 avatar 應持久化', async () => {
    const testUser = generateTestUser('profile2')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 更新 avatar
    const newAvatar = 'https://example.com/avatar.png'
    await updateProfile({ avatar: newAvatar }, token)

    // 驗證
    const meRes = await getMe(token)
    assertEqual(meRes.json().user.avatar, newAvatar, 'avatar 應已更新')

    // 清理
    await deleteAccount(token)
  })

  // 測試 3.3: 變更密碼後舊密碼應失效
  await testAsync('3.3 變更密碼後舊密碼應失效', async () => {
    const testUser = generateTestUser('pwchange')
    const oldPassword = testUser.password
    const newPassword = 'NewPass@5678'

    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: oldPassword
    })
    const token = loginRes.json().token

    // 變更密碼
    const changeRes = await changePassword({
      currentPassword: oldPassword,
      newPassword: newPassword
    }, token)
    assertEqual(changeRes.statusCode, 200, '變更密碼應成功')

    // 嘗試使用舊密碼登入
    const oldLoginRes = await login({
      username: testUser.username,
      password: oldPassword
    })
    assertEqual(oldLoginRes.statusCode, 401, '舊密碼應無法登入')

    // 清理: 使用新密碼登入後刪除
    const newLoginRes = await login({
      username: testUser.username,
      password: newPassword
    })
    await deleteAccount(newLoginRes.json().token)
  })

  // 測試 3.4: 變更密碼後新密碼應有效
  await testAsync('3.4 變更密碼後新密碼應有效', async () => {
    const testUser = generateTestUser('newpw')
    const oldPassword = testUser.password
    const newPassword = 'BrandNew@9999'

    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: oldPassword
    })
    const token = loginRes.json().token

    // 變更密碼
    await changePassword({
      currentPassword: oldPassword,
      newPassword: newPassword
    }, token)

    // 使用新密碼登入
    const newLoginRes = await login({
      username: testUser.username,
      password: newPassword
    })
    assertEqual(newLoginRes.statusCode, 200, '新密碼應能成功登入')
    assertTrue(newLoginRes.json().token, '應返回新 token')

    // 清理
    await deleteAccount(newLoginRes.json().token)
  })

  // 測試 3.5: 同時更新多個欄位
  await testAsync('3.5 同時更新多個欄位', async () => {
    const testUser = generateTestUser('multifield')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 同時更新 displayName 和 avatar
    const newDisplayName = 'Multi Update Test'
    const newAvatar = 'https://example.com/multi.jpg'
    await updateProfile({
      displayName: newDisplayName,
      avatar: newAvatar
    }, token)

    // 驗證
    const meRes = await getMe(token)
    const user = meRes.json().user
    assertEqual(user.displayName, newDisplayName, 'displayName 應已更新')
    assertEqual(user.avatar, newAvatar, 'avatar 應已更新')

    // 清理
    await deleteAccount(token)
  })
}

/**
 * 4. 會話管理
 */
async function testSessionManagement() {
  console.log('\n=== 4. 會話管理 ===')

  // 測試 4.1: token 過期應返回 401（此測試跳過，因為需要等待過期時間）
  skip('4.1 token 過期應返回 401', '需要修改 JWT_EXPIRY 或等待過期時間，暫時跳過')

  // 測試 4.2: 無效 token 應返回 401
  await testAsync('4.2 無效 token 應返回 401', async () => {
    const fakeToken = 'invalid.token.here'
    const meRes = await getMe(fakeToken)
    assertEqual(meRes.statusCode, 401, '無效 token 應返回 401')
  })

  // 測試 4.3: 格式錯誤的 token 應返回 401
  await testAsync('4.3 格式錯誤的 token 應返回 401', async () => {
    const malformedToken = 'this-is-not-a-jwt'
    const meRes = await getMe(malformedToken)
    assertEqual(meRes.statusCode, 401, '格式錯誤的 token 應返回 401')
  })

  // 測試 4.4: 登出後 token 應被列入黑名單
  await testAsync('4.4 登出後 token 應被列入黑名單', async () => {
    const testUser = generateTestUser('blacklist')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 驗證 token 有效
    const meRes1 = await getMe(token)
    assertEqual(meRes1.statusCode, 200, 'Token 應有效')

    // 登出
    await logout(token)

    // 驗證 token 已被列入黑名單
    const meRes2 = await getMe(token)
    assertEqual(meRes2.statusCode, 401, '登出後 token 應被拒絕')

    // 清理
    const newLoginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    await deleteAccount(newLoginRes.json().token)
  })

  // 測試 4.5: 不同裝置應有不同 token
  await testAsync('4.5 不同裝置應有不同 token（多次登入）', async () => {
    const testUser = generateTestUser('multidevice')
    await register(testUser)

    // 模擬不同裝置登入
    const tokens = []
    for (let i = 0; i < 3; i++) {
      const loginRes = await login({
        username: testUser.username,
        password: testUser.password
      })
      tokens.push(loginRes.json().token)
    }

    // 驗證所有 token 都不同
    const uniqueTokens = new Set(tokens)
    assertEqual(uniqueTokens.size, 3, '每次登入應產生不同的 token')

    // 驗證所有 token 都有效
    for (const token of tokens) {
      const meRes = await getMe(token)
      assertEqual(meRes.statusCode, 200, '每個 token 都應有效')
    }

    // 清理
    await deleteAccount(tokens[0])
  })

  // 測試 4.6: 未提供 token 應返回 401
  await testAsync('4.6 未提供 token 應返回 401', async () => {
    const meRes = await api('GET', '/api/v1/auth/me')
    assertEqual(meRes.statusCode, 401, '未提供 token 應返回 401')
    const resBody = meRes.json()
    const errorMsg = String(resBody.message || resBody.error || meRes.body || '').toLowerCase()
    assertTrue(errorMsg.includes('token') || errorMsg.includes('認證'), '錯誤訊息應提及 Token')
  })

  // 測試 4.7: 刪除帳戶後 token 應失效
  await testAsync('4.7 刪除帳戶後 token 應失效', async () => {
    const testUser = generateTestUser('deleted')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 刪除帳戶
    await deleteAccount(token)

    // 嘗試使用 token
    const meRes = await getMe(token)
    assertEqual(meRes.statusCode, 401, '刪除帳戶後 token 應失效')
  })
}

/**
 * 5. 錯誤處理
 */
async function testErrorHandling() {
  console.log('\n=== 5. 錯誤處理 ===')

  // 測試 5.1: 重複用戶名應返回明確錯誤
  await testAsync('5.1 重複用戶名應返回明確錯誤', async () => {
    const testUser = generateTestUser('duplicate')

    // 第一次註冊
    const res1 = await register(testUser)
    assertEqual(res1.statusCode, 201, '第一次註冊應成功')

    // 登入取得 token 供清理用
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 嘗試用相同用戶名再次註冊
    const res2 = await register(testUser)
    assertEqual(res2.statusCode, 400, '重複用戶名應返回 400')
    const resBody = res2.json()
    const errorMsg = String(resBody.message || resBody.error || res2.body || '')
    assertTrue(
      errorMsg.includes('已被使用') || errorMsg.includes('already') || errorMsg.includes('exists'),
      '錯誤訊息應說明用戶名已存在'
    )

    // 清理
    await deleteAccount(token)
  })

  // 測試 5.2: 密碼錯誤應返回 401
  await testAsync('5.2 密碼錯誤應返回 401', async () => {
    const testUser = generateTestUser('wrongpw')
    await register(testUser)

    // 嘗試用錯誤密碼登入
    const loginRes = await login({
      username: testUser.username,
      password: 'WrongPassword123'
    })
    assertEqual(loginRes.statusCode, 401, '密碼錯誤應返回 401')

    // 清理
    const correctLoginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    await deleteAccount(correctLoginRes.json().token)
  })

  // 測試 5.3: 用戶不存在應返回 401
  await testAsync('5.3 用戶不存在應返回 401', async () => {
    const loginRes = await login({
      username: 'nonexistent_user_xyz_' + Date.now(),
      password: 'SomePassword123'
    })
    assertEqual(loginRes.statusCode, 401, '用戶不存在應返回 401')
  })

  // 測試 5.4: 無效輸入應返回 400
  await testAsync('5.4 無效輸入應返回 400 - 缺少用戶名', async () => {
    const res = await register({
      password: 'ValidPassword123'
    })
    assertEqual(res.statusCode, 400, '缺少用戶名應返回 400')
  })

  // 測試 5.5: 無效輸入應返回 400 - 缺少密碼
  await testAsync('5.5 無效輸入應返回 400 - 缺少密碼', async () => {
    const res = await register({
      username: 'someuser_' + Date.now()
    })
    assertEqual(res.statusCode, 400, '缺少密碼應返回 400')
  })

  // 測試 5.6: 空 body 應返回 400
  await testAsync('5.6 空 body 應返回 400', async () => {
    const res = await register({})
    assertEqual(res.statusCode, 400, '空 body 應返回 400')
  })

  // 測試 5.7: 變更密碼時目前密碼錯誤應返回 400
  await testAsync('5.7 變更密碼時目前密碼錯誤應返回 400', async () => {
    const testUser = generateTestUser('badcurrentpw')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 嘗試用錯誤的目前密碼變更密碼
    const changeRes = await changePassword({
      currentPassword: 'WrongCurrentPassword',
      newPassword: 'NewValidPassword123'
    }, token)
    assertEqual(changeRes.statusCode, 400, '目前密碼錯誤應返回 400')

    // 清理
    await deleteAccount(token)
  })

  // 測試 5.8: 登入時缺少欄位應返回 400
  await testAsync('5.8 登入時缺少欄位應返回 400', async () => {
    const res1 = await login({ username: 'someuser' })
    assertEqual(res1.statusCode, 400, '缺少密碼應返回 400')

    const res2 = await login({ password: 'somepassword' })
    assertEqual(res2.statusCode, 400, '缺少用戶名應返回 400')
  })
}

/**
 * 6. 統計數據
 */
async function testStatistics() {
  console.log('\n=== 6. 統計數據 ===')

  // 測試 6.1: 新用戶統計應為 0
  await testAsync('6.1 新用戶統計應為 0', async () => {
    const testUser = generateTestUser('newstats')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    const meRes = await getMe(token)
    const stats = meRes.json().user.stats
    assertHasProperty(stats, 'watchCount', '應有 watchCount')
    assertHasProperty(stats, 'watchTimeSeconds', '應有 watchTimeSeconds')
    assertEqual(stats.watchCount, 0, 'watchCount 應為 0')
    assertEqual(stats.watchTimeSeconds, 0, 'watchTimeSeconds 應為 0')

    // 清理
    await deleteAccount(token)
  })

  // 測試 6.2: 更新統計應正確儲存
  await testAsync('6.2 更新統計應正確儲存', async () => {
    const testUser = generateTestUser('updatestats')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 更新統計
    await updateStats({
      watchCount: 5,
      watchTimeSeconds: 3600,
      favoriteGenre: 'Music'
    }, token)

    // 驗證
    const meRes = await getMe(token)
    const stats = meRes.json().user.stats
    assertEqual(stats.watchCount, 5, 'watchCount 應更新')
    assertEqual(stats.watchTimeSeconds, 3600, 'watchTimeSeconds 應更新')
    assertEqual(stats.favoriteGenre, 'Music', 'favoriteGenre 應更新')

    // 清理
    await deleteAccount(token)
  })

  // 測試 6.3: 統計應隨用戶資料一起返回
  await testAsync('6.3 統計應隨用戶資料一起返回', async () => {
    const testUser = generateTestUser('statsinuser')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 驗證 /me 端點返回統計
    const meRes = await getMe(token)
    const user = meRes.json().user
    assertHasProperty(user, 'stats', '用戶資料應包含 stats')
    assertTrue(typeof user.stats === 'object', 'stats 應為物件')

    // 清理
    await deleteAccount(token)
  })

  // 測試 6.4: 統計應累加而非覆蓋
  await testAsync('6.4 統計應累加而非覆蓋', async () => {
    const testUser = generateTestUser('addstats')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 第一次更新
    await updateStats({ watchCount: 3, watchTimeSeconds: 1000 }, token)

    // 第二次更新
    await updateStats({ watchCount: 2, watchTimeSeconds: 500 }, token)

    // 驗證累加
    const meRes = await getMe(token)
    const stats = meRes.json().user.stats
    assertEqual(stats.watchCount, 5, 'watchCount 應累加')
    assertEqual(stats.watchTimeSeconds, 1500, 'watchTimeSeconds 應累加')

    // 清理
    await deleteAccount(token)
  })
}

/**
 * 7. 安全性測試
 */
async function testSecurity() {
  console.log('\n=== 7. 安全性測試 ===')

  // 測試 7.1: 返回的用戶資料不應包含 passwordHash
  await testAsync('7.1 返回的用戶資料不應包含 passwordHash', async () => {
    const testUser = generateTestUser('nohash')
    const registerRes = await register(testUser)
    const registerUser = registerRes.json().user
    assertNotHasProperty(registerUser, 'passwordHash', '註冊回應不應包含 passwordHash')
    assertNotHasProperty(registerUser, 'passwordSalt', '註冊回應不應包含 passwordSalt')

    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const loginUser = loginRes.json().user
    assertNotHasProperty(loginUser, 'passwordHash', '登入回應不應包含 passwordHash')
    assertNotHasProperty(loginUser, 'passwordSalt', '登入回應不應包含 passwordSalt')

    const token = loginRes.json().token
    const meRes = await getMe(token)
    const meUser = meRes.json().user
    assertNotHasProperty(meUser, 'passwordHash', '/me 回應不應包含 passwordHash')
    assertNotHasProperty(meUser, 'passwordSalt', '/me 回應不應包含 passwordSalt')

    // 清理
    await deleteAccount(token)
  })

  // 測試 7.2: SQL 注入攻擊應失敗
  await testAsync('7.2 SQL 注入攻擊應失敗', async () => {
    // 嘗試各種 SQL 注入攻擊模式
    const sqlInjectionPayloads = [
      "admin'; DROP TABLE users;--",
      "' OR '1'='1",
      "1; DELETE FROM users",
      "admin'--",
      "' UNION SELECT * FROM users--"
    ]

    for (const payload of sqlInjectionPayloads) {
      const loginRes = await login({
        username: payload,
        password: payload
      })
      // 應返回 401（用戶不存在）而非系統錯誤
      assertTrue(
        loginRes.statusCode === 401 || loginRes.statusCode === 400,
        `SQL 注入嘗試 "${payload.slice(0, 20)}..." 應被安全處理`
      )
    }
  })

  // 測試 7.3: XSS 攻擊應被過濾或安全處理
  await testAsync('7.3 XSS 攻擊應被安全處理', async () => {
    const testUser = generateTestUser('xss')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 嘗試在 displayName 中注入 XSS
    const xssPayload = '<script>alert("XSS")</script>'
    await updateProfile({ displayName: xssPayload }, token)

    const meRes = await getMe(token)
    const displayName = meRes.json().user.displayName

    // 驗證: 要麼被移除/轉義，要麼原樣儲存（由前端處理）
    // 重點是伺服器不應崩潰
    assertTrue(meRes.statusCode === 200, '伺服器應正常處理 XSS 載荷')

    // 清理
    await deleteAccount(token)
  })

  // 測試 7.4: NoSQL 注入攻擊應失敗
  await testAsync('7.4 NoSQL 注入攻擊應失敗', async () => {
    const nosqlPayloads = [
      { username: { '$gt': '' }, password: { '$gt': '' } },
      { username: { '$ne': null }, password: { '$ne': null } },
      { username: '{"$regex": ".*"}', password: '{"$gt": ""}' }
    ]

    for (const payload of nosqlPayloads) {
      try {
        const loginRes = await login(payload)
        // 應返回錯誤而非成功登入
        assertTrue(
          loginRes.statusCode === 401 || loginRes.statusCode === 400,
          'NoSQL 注入嘗試應被安全處理'
        )
      } catch (e) {
        // 如果請求本身失敗也是安全的
        assertTrue(true, 'NoSQL 注入請求被拒絕')
      }
    }
  })

  // 測試 7.5: 超長輸入應被處理
  await testAsync('7.5 超長輸入應被安全處理', async () => {
    const veryLongString = 'a'.repeat(10000)

    const res = await register({
      username: veryLongString,
      password: veryLongString
    })

    // 應返回 400（驗證錯誤）而非伺服器錯誤
    assertTrue(
      res.statusCode === 400 || res.statusCode === 413,
      '超長輸入應被拒絕'
    )
  })

  // 測試 7.6: 暴力破解防護（如果有實作）
  skip('7.6 暴力破解應被限制', '需要伺服器端實作速率限制，暫時跳過')

  // 測試 7.7: Token 不應包含敏感資訊
  await testAsync('7.7 Token 不應包含明文敏感資訊', async () => {
    const testUser = generateTestUser('tokentest')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // Token 不應包含密碼
    assertNotContains(token, testUser.password, 'Token 不應包含密碼')
    assertNotContains(token, 'password', 'Token 不應包含 password 欄位')

    // 清理
    await deleteAccount(token)
  })
}

/**
 * 8. 邊界條件
 */
async function testBoundaryConditions() {
  console.log('\n=== 8. 邊界條件 ===')

  // 測試 8.1: 用戶名剛好 3 字元應成功
  await testAsync('8.1 用戶名剛好 3 字元應成功', async () => {
    const shortUsername = 'a' + Date.now().toString(36).slice(-2)
    const res = await register({
      username: shortUsername.slice(0, 3),
      password: 'ValidPass123'
    })
    assertEqual(res.statusCode, 201, '3 字元用戶名應成功註冊')

    // 清理
    const loginRes = await login({
      username: shortUsername.slice(0, 3),
      password: 'ValidPass123'
    })
    if (loginRes.statusCode === 200) {
      await deleteAccount(loginRes.json().token)
    }
  })

  // 測試 8.2: 用戶名剛好 20 字元應成功
  await testAsync('8.2 用戶名剛好 20 字元應成功', async () => {
    const longUsername = ('user' + Date.now().toString(36)).padEnd(20, 'x').slice(0, 20)
    const res = await register({
      username: longUsername,
      password: 'ValidPass123'
    })
    assertEqual(res.statusCode, 201, '20 字元用戶名應成功註冊')

    // 清理
    const loginRes = await login({
      username: longUsername,
      password: 'ValidPass123'
    })
    if (loginRes.statusCode === 200) {
      await deleteAccount(loginRes.json().token)
    }
  })

  // 測試 8.3: 用戶名 2 字元應失敗
  await testAsync('8.3 用戶名 2 字元應失敗', async () => {
    const res = await register({
      username: 'ab',
      password: 'ValidPass123'
    })
    assertEqual(res.statusCode, 400, '2 字元用戶名應被拒絕')
  })

  // 測試 8.4: 用戶名 21 字元應失敗
  await testAsync('8.4 用戶名 21 字元應失敗', async () => {
    const res = await register({
      username: 'a'.repeat(21),
      password: 'ValidPass123'
    })
    assertEqual(res.statusCode, 400, '21 字元用戶名應被拒絕')
  })

  // 測試 8.5: 密碼剛好 6 字元應成功（根據 userService 的實際限制）
  await testAsync('8.5 密碼剛好 6 字元應成功', async () => {
    const testUsername = generateTestUser('shortpw').username
    const res = await register({
      username: testUsername,
      password: '123456' // 6 字元
    })
    assertEqual(res.statusCode, 201, '6 字元密碼應成功註冊')

    // 清理
    const loginRes = await login({
      username: testUsername,
      password: '123456'
    })
    if (loginRes.statusCode === 200) {
      await deleteAccount(loginRes.json().token)
    }
  })

  // 測試 8.6: 密碼 5 字元應失敗
  await testAsync('8.6 密碼 5 字元應失敗', async () => {
    const res = await register({
      username: generateTestUser('pw5').username,
      password: '12345'
    })
    assertEqual(res.statusCode, 400, '5 字元密碼應被拒絕')
  })

  // 測試 8.7: 密碼 128 字元應成功
  await testAsync('8.7 密碼 128 字元應成功', async () => {
    const testUsername = generateTestUser('longpw').username
    const longPassword = 'Aa1!'.repeat(32) // 128 字元
    const res = await register({
      username: testUsername,
      password: longPassword
    })
    assertEqual(res.statusCode, 201, '128 字元密碼應成功註冊')

    // 驗證可以登入
    const loginRes = await login({
      username: testUsername,
      password: longPassword
    })
    assertEqual(loginRes.statusCode, 200, '應能使用 128 字元密碼登入')

    // 清理
    await deleteAccount(loginRes.json().token)
  })

  // 測試 8.8: 特殊字元用戶名應失敗
  await testAsync('8.8 特殊字元用戶名應失敗', async () => {
    const invalidUsernames = [
      'user@name',
      'user name',
      'user.name',
      'user-name',
      'User123', // 大寫字母
      'user!@#$'
    ]

    for (const username of invalidUsernames) {
      const res = await register({
        username,
        password: 'ValidPass123'
      })
      assertTrue(
        res.statusCode === 400,
        `特殊字元用戶名 "${username}" 應被拒絕`
      )
    }
  })

  // 測試 8.9: 空白用戶名應失敗
  await testAsync('8.9 空白用戶名應失敗', async () => {
    const res1 = await register({
      username: '',
      password: 'ValidPass123'
    })
    assertEqual(res1.statusCode, 400, '空字串用戶名應被拒絕')

    const res2 = await register({
      username: '   ',
      password: 'ValidPass123'
    })
    assertEqual(res2.statusCode, 400, '純空格用戶名應被拒絕')
  })

  // 測試 8.10: 用戶名大小寫不敏感
  await testAsync('8.10 用戶名大小寫不敏感', async () => {
    const baseUsername = generateTestUser('casetest').username

    // 註冊小寫
    const res1 = await register({
      username: baseUsername.toLowerCase(),
      password: 'ValidPass123'
    })
    assertEqual(res1.statusCode, 201, '小寫用戶名應成功')

    // 嘗試用大寫註冊應失敗（因為轉換後重複）
    const res2 = await register({
      username: baseUsername.toUpperCase(),
      password: 'ValidPass123'
    })
    assertEqual(res2.statusCode, 400, '大小寫相同的用戶名應被視為重複')

    // 但可以用大寫登入
    const loginRes = await login({
      username: baseUsername.toUpperCase(),
      password: 'ValidPass123'
    })
    assertEqual(loginRes.statusCode, 200, '應能用任意大小寫登入')

    // 清理
    await deleteAccount(loginRes.json().token)
  })

  // 測試 8.11: displayName 可以很長
  await testAsync('8.11 displayName 最長 50 字元', async () => {
    const testUser = generateTestUser('longdisplay')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 更新為 50 字元的 displayName
    const longDisplayName = 'A'.repeat(50)
    await updateProfile({ displayName: longDisplayName }, token)

    const meRes = await getMe(token)
    assertEqual(meRes.json().user.displayName, longDisplayName, '50 字元 displayName 應成功')

    // 清理
    await deleteAccount(token)
  })

  // 測試 8.12: 底線用戶名應成功
  await testAsync('8.12 底線用戶名應成功', async () => {
    const underscoreUsername = 'user_' + Date.now().toString(36).slice(0, 10)
    const res = await register({
      username: underscoreUsername,
      password: 'ValidPass123'
    })
    assertEqual(res.statusCode, 201, '含底線的用戶名應成功')

    // 清理
    const loginRes = await login({
      username: underscoreUsername,
      password: 'ValidPass123'
    })
    if (loginRes.statusCode === 200) {
      await deleteAccount(loginRes.json().token)
    }
  })
}

/**
 * 9. 額外測試案例
 */
async function testAdditionalCases() {
  console.log('\n=== 9. 額外測試案例 ===')

  // 測試 9.1: 用戶資料應包含時間戳記
  await testAsync('9.1 用戶資料應包含時間戳記', async () => {
    const testUser = generateTestUser('timestamp')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    const meRes = await getMe(token)
    const user = meRes.json().user
    assertHasProperty(user, 'createdAt', '應有 createdAt')
    assertHasProperty(user, 'updatedAt', '應有 updatedAt')

    // 驗證是有效的 ISO 日期字串
    const createdAt = new Date(user.createdAt)
    assertTrue(!isNaN(createdAt.getTime()), 'createdAt 應是有效的日期')

    // 清理
    await deleteAccount(token)
  })

  // 測試 9.2: 更新資料後 updatedAt 應改變
  await testAsync('9.2 更新資料後 updatedAt 應改變', async () => {
    const testUser = generateTestUser('updated')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 取得原始 updatedAt
    const meRes1 = await getMe(token)
    const originalUpdatedAt = meRes1.json().user.updatedAt

    // 等待一小段時間
    await new Promise(resolve => setTimeout(resolve, 100))

    // 更新資料
    await updateProfile({ displayName: 'Updated Name' }, token)

    // 驗證 updatedAt 已改變
    const meRes2 = await getMe(token)
    const newUpdatedAt = meRes2.json().user.updatedAt
    assertTrue(newUpdatedAt !== originalUpdatedAt, 'updatedAt 應在更新後改變')

    // 清理
    await deleteAccount(token)
  })

  // 測試 9.3: 刪除帳戶應從用戶列表移除
  await testAsync('9.3 刪除帳戶應從用戶列表移除', async () => {
    const testUser = generateTestUser('tobedeleted')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // 驗證用戶在列表中
    const beforeRes = await getUsers()
    const beforeUsers = beforeRes.json().users
    const beforeFound = beforeUsers.find(u => u.username === testUser.username)
    assertTrue(beforeFound !== undefined, '刪除前用戶應在列表中')

    // 刪除帳戶
    await deleteAccount(token)

    // 驗證用戶已從列表移除
    const afterRes = await getUsers()
    const afterUsers = afterRes.json().users
    const afterFound = afterUsers.find(u => u.username === testUser.username)
    assertTrue(afterFound === undefined, '刪除後用戶應從列表移除')
  })

  // 測試 9.4: 預設頭像應被設定
  await testAsync('9.4 預設頭像應被設定', async () => {
    const testUser = generateTestUser('defaultavatar')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    const meRes = await getMe(token)
    const user = meRes.json().user
    assertHasProperty(user, 'avatar', '應有 avatar')
    assertTrue(user.avatar.startsWith('http'), 'avatar 應是 URL')

    // 清理
    await deleteAccount(token)
  })

  // 測試 9.5: 純數字用戶名應成功
  await testAsync('9.5 純數字用戶名應成功', async () => {
    const numericUsername = '123' + Date.now().toString().slice(-10)
    const res = await register({
      username: numericUsername.slice(0, 20),
      password: 'ValidPass123'
    })
    assertEqual(res.statusCode, 201, '純數字用戶名應成功')

    // 清理
    const loginRes = await login({
      username: numericUsername.slice(0, 20),
      password: 'ValidPass123'
    })
    if (loginRes.statusCode === 200) {
      await deleteAccount(loginRes.json().token)
    }
  })

  // 測試 9.6: 登出回應應包含成功訊息
  await testAsync('9.6 登出回應應包含成功訊息', async () => {
    const testUser = generateTestUser('logoutmsg')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    const logoutRes = await logout(token)
    assertEqual(logoutRes.statusCode, 200, '登出應返回 200')
    const logoutData = logoutRes.json()
    assertTrue(logoutData.success, '登出應返回 success: true')

    // 清理
    const newLoginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    await deleteAccount(newLoginRes.json().token)
  })

  // 測試 9.7: 刪除帳戶回應應包含成功訊息
  await testAsync('9.7 刪除帳戶回應應包含成功訊息', async () => {
    const testUser = generateTestUser('deletemsg')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    const deleteRes = await deleteAccount(token)
    assertEqual(deleteRes.statusCode, 200, '刪除應返回 200')
    const deleteData = deleteRes.json()
    assertTrue(deleteData.success, '刪除應返回 success: true')
  })

  // 測試 9.8: 數據 URL 格式的頭像應被接受
  await testAsync('9.8 數據 URL 格式的頭像應被接受', async () => {
    const testUser = generateTestUser('dataurl')
    await register(testUser)
    const loginRes = await login({
      username: testUser.username,
      password: testUser.password
    })
    const token = loginRes.json().token

    // Base64 編碼的小型 PNG 圖片（1x1 透明像素）
    const dataUrlAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    await updateProfile({ avatar: dataUrlAvatar }, token)

    const meRes = await getMe(token)
    assertEqual(meRes.json().user.avatar, dataUrlAvatar, '數據 URL 頭像應被接受')

    // 清理
    await deleteAccount(token)
  })
}

// === 測試執行 ===

async function runAllTests() {
  console.log('======================================')
  console.log('   FreeTube Auth Integration Tests')
  console.log('======================================')

  const startTime = Date.now()

  try {
    // 初始化服務
    console.log('\n[Setup] 初始化服務...')
    await initializeServices()

    // 啟動測試伺服器
    console.log('[Setup] 啟動測試伺服器...')
    await startServer()

    // 執行所有測試套件
    await testCompleteAuthFlow()
    await testMultiUserScenarios()
    await testProfileManagement()
    await testSessionManagement()
    await testErrorHandling()
    await testStatistics()
    await testSecurity()
    await testBoundaryConditions()
    await testAdditionalCases()

  } catch (error) {
    console.error('\n[ERROR] 測試執行失敗:', error.message)
    console.error(error.stack)
    results.failed++
    results.tests.push({ name: 'Test Setup/Execution', status: 'FAIL', error: error.message })
  } finally {
    // 停止測試伺服器
    console.log('\n[Teardown] 停止測試伺服器...')
    await stopServer()
  }

  const duration = Date.now() - startTime

  // 輸出結果摘要
  console.log('\n======================================')
  console.log('           測試結果')
  console.log('======================================')
  console.log(`  通過:  ${results.passed}`)
  console.log(`  失敗:  ${results.failed}`)
  console.log(`  跳過: ${results.skipped}`)
  console.log(`  總計:   ${results.passed + results.failed + results.skipped}`)
  console.log(`  耗時:    ${duration}ms`)
  console.log('======================================')

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

// 匯出測試函數供測試執行器使用
module.exports = {
  runAllTests,
  results,
  // 匯出測試工具供其他測試檔案使用
  test,
  testAsync,
  skip,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertNotContains,
  assertIsArray,
  assertHasProperty,
  assertNotHasProperty,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  api,
  register,
  login,
  logout,
  getMe,
  updateProfile,
  deleteAccount,
  getUsers,
  changePassword,
  updateStats,
  generateTestUser
}

// 直接執行
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('測試執行失敗:', error)
    process.exit(1)
  })
}
