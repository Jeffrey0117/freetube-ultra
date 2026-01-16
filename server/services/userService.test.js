/**
 * UserService 單元測試
 * 測試用戶服務層的所有功能
 *
 * 執行: node server/services/userService.test.js
 */

'use strict'

const path = require('path')
const fs = require('fs')

// === 測試環境設定 ===
// 在載入 UserService 之前，先 mock config 來使用測試目錄
const TEST_DATA_DIR = path.join(__dirname, '.test-users')
const ORIGINAL_CONFIG_PATH = require.resolve('../config')

// 建立測試用的 config mock
const originalConfig = require('../config')
const testConfig = {
  ...originalConfig,
  cache: {
    ...originalConfig.cache,
    baseDir: TEST_DATA_DIR
  }
}

// 替換 require cache 中的 config
require.cache[ORIGINAL_CONFIG_PATH] = {
  id: ORIGINAL_CONFIG_PATH,
  filename: ORIGINAL_CONFIG_PATH,
  loaded: true,
  exports: testConfig
}

// 現在載入 UserService（會使用 mock 的 config）
const { UserService, hashPassword, verifyPassword, generateId, sanitizeUser } = require('./userService')

// === 測試框架 ===
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
}

/**
 * 同步測試函數
 */
function test(name, fn) {
  try {
    fn()
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    console.log(`  ✓ ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    console.log(`  ✗ ${name}`)
    console.log(`    Error: ${error.message}`)
  }
}

/**
 * 非同步測試函數
 */
async function testAsync(name, fn) {
  try {
    await fn()
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    console.log(`  ✓ ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    console.log(`  ✗ ${name}`)
    console.log(`    Error: ${error.message}`)
  }
}

/**
 * 跳過測試
 */
function skip(name, reason) {
  results.skipped++
  results.tests.push({ name, status: 'SKIP', reason })
  console.log(`  ○ ${name} (跳過: ${reason})`)
}

// === 斷言函數 ===

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || '斷言失敗'}: 預期 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}`)
  }
}

function assertNotEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    throw new Error(`${message || '斷言失敗'}: 值不應相等 ${JSON.stringify(actual)}`)
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || '預期 true 但得到 false')
  }
}

function assertFalse(value, message) {
  if (value) {
    throw new Error(message || '預期 false 但得到 true')
  }
}

function assertNull(value, message) {
  if (value !== null) {
    throw new Error(message || `預期 null 但得到 ${JSON.stringify(value)}`)
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || '預期非 null 值')
  }
}

function assertDefined(value, message) {
  if (value === undefined) {
    throw new Error(message || '預期已定義的值，但得到 undefined')
  }
}

function assertUndefined(value, message) {
  if (value !== undefined) {
    throw new Error(message || `預期 undefined，但得到 ${JSON.stringify(value)}`)
  }
}

function assertThrows(fn, expectedMessage, message) {
  let threw = false
  let actualMessage = ''
  try {
    fn()
  } catch (error) {
    threw = true
    actualMessage = error.message
  }

  if (!threw) {
    throw new Error(message || '預期拋出錯誤，但沒有')
  }

  if (expectedMessage && !actualMessage.includes(expectedMessage)) {
    throw new Error(`${message || '錯誤訊息不匹配'}: 預期包含 "${expectedMessage}"，實際 "${actualMessage}"`)
  }
}

async function assertThrowsAsync(fn, expectedMessage, message) {
  let threw = false
  let actualMessage = ''
  try {
    await fn()
  } catch (error) {
    threw = true
    actualMessage = error.message
  }

  if (!threw) {
    throw new Error(message || '預期拋出錯誤，但沒有')
  }

  if (expectedMessage && !actualMessage.includes(expectedMessage)) {
    throw new Error(`${message || '錯誤訊息不匹配'}: 預期包含 "${expectedMessage}"，實際 "${actualMessage}"`)
  }
}

function assertContains(obj, key, message) {
  if (!(key in obj)) {
    throw new Error(message || `預期物件包含鍵 "${key}"`)
  }
}

function assertNotContains(obj, key, message) {
  if (key in obj) {
    throw new Error(message || `預期物件不包含鍵 "${key}"`)
  }
}

function assertType(value, expectedType, message) {
  const actualType = typeof value
  if (actualType !== expectedType) {
    throw new Error(`${message || '類型不匹配'}: 預期 ${expectedType}，實際 ${actualType}`)
  }
}

// === 測試工具函數 ===

/**
 * 清理測試資料目錄
 */
function cleanupTestDir() {
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    }
  } catch (e) {
    // 忽略錯誤
  }
}

/**
 * 建立新的 UserService 實例（帶乾淨資料）
 */
function createFreshUserService() {
  // 確保測試目錄存在
  const usersDir = path.join(TEST_DATA_DIR, 'users')
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir, { recursive: true })
  }

  // 清空用戶資料
  const usersFile = path.join(usersDir, 'users.json')
  fs.writeFileSync(usersFile, '[]')

  // 建立新實例
  return new UserService()
}

// === 測試套件 ===

/**
 * 測試工具函數
 */
async function testUtilityFunctions() {
  console.log('\n=== 工具函數測試 ===')

  await testAsync('hashPassword 應產生雜湊和鹽值', async () => {
    const result = await hashPassword('testpassword')
    assertDefined(result.hash, '應有 hash')
    assertDefined(result.salt, '應有 salt')
    assertType(result.hash, 'string', 'hash 應為字串')
    assertType(result.salt, 'string', 'salt 應為字串')
    assertTrue(result.hash.length > 0, 'hash 應有內容')
    assertTrue(result.salt.length > 0, 'salt 應有內容')
  })

  await testAsync('hashPassword 相同密碼不同鹽應產生不同雜湊', async () => {
    const result1 = await hashPassword('samepassword')
    const result2 = await hashPassword('samepassword')
    assertNotEqual(result1.hash, result2.hash, '雜湊應不同')
    assertNotEqual(result1.salt, result2.salt, '鹽值應不同')
  })

  await testAsync('verifyPassword 正確密碼應返回 true', async () => {
    const { hash, salt } = await hashPassword('mypassword')
    const isValid = await verifyPassword('mypassword', hash, salt)
    assertTrue(isValid, '驗證應成功')
  })

  await testAsync('verifyPassword 錯誤密碼應返回 false', async () => {
    const { hash, salt } = await hashPassword('correctpassword')
    const isValid = await verifyPassword('wrongpassword', hash, salt)
    assertFalse(isValid, '驗證應失敗')
  })

  test('generateId 應產生有效 UUID', () => {
    const id = generateId()
    assertDefined(id, '應產生 ID')
    assertType(id, 'string', 'ID 應為字串')
    // UUID 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    assertTrue(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id), 'ID 應為有效 UUID 格式')
  })

  test('generateId 每次應產生唯一 ID', () => {
    const id1 = generateId()
    const id2 = generateId()
    const id3 = generateId()
    assertNotEqual(id1, id2, 'ID 應唯一')
    assertNotEqual(id2, id3, 'ID 應唯一')
    assertNotEqual(id1, id3, 'ID 應唯一')
  })

  test('sanitizeUser 應移除敏感資訊', () => {
    const user = {
      _id: 'test-id',
      username: 'testuser',
      displayName: 'Test User',
      passwordHash: 'secret-hash',
      passwordSalt: 'secret-salt',
      createdAt: '2024-01-01'
    }
    const safe = sanitizeUser(user)

    assertContains(safe, '_id', '應保留 _id')
    assertContains(safe, 'username', '應保留 username')
    assertContains(safe, 'displayName', '應保留 displayName')
    assertNotContains(safe, 'passwordHash', '應移除 passwordHash')
    assertNotContains(safe, 'passwordSalt', '應移除 passwordSalt')
  })

  test('sanitizeUser 傳入 null 應返回 null', () => {
    const result = sanitizeUser(null)
    assertNull(result, '應返回 null')
  })

  test('sanitizeUser 傳入 undefined 應返回 null', () => {
    const result = sanitizeUser(undefined)
    assertNull(result, '應返回 null')
  })
}

/**
 * 測試用戶註冊功能
 */
async function testUserRegistration() {
  console.log('\n=== 用戶註冊測試 ===')

  await testAsync('成功註冊新用戶', async () => {
    const service = createFreshUserService()
    const user = await service.register('newuser', 'password123', 'New User')

    assertDefined(user._id, '應有用戶 ID')
    assertEqual(user.username, 'newuser', '用戶名應正確')
    assertEqual(user.displayName, 'New User', '顯示名稱應正確')
    assertNotContains(user, 'passwordHash', '不應包含密碼雜湊')
    assertNotContains(user, 'passwordSalt', '不應包含密碼鹽值')
  })

  await testAsync('用戶名已存在應失敗', async () => {
    const service = createFreshUserService()
    await service.register('existinguser', 'password123')

    await assertThrowsAsync(
      async () => await service.register('existinguser', 'anotherpassword'),
      '已被使用',
      '應拋出用戶名已存在錯誤'
    )
  })

  await testAsync('用戶名已存在（不同大小寫）應失敗', async () => {
    const service = createFreshUserService()
    await service.register('testuser', 'password123')

    await assertThrowsAsync(
      async () => await service.register('TestUser', 'anotherpassword'),
      '已被使用',
      '應拋出用戶名已存在錯誤（大小寫不敏感）'
    )
  })

  await testAsync('無效用戶名格式應失敗 - 太短', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('ab', 'password123'),
      '3-20',
      '應拋出用戶名長度錯誤'
    )
  })

  await testAsync('無效用戶名格式應失敗 - 太長', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('a'.repeat(21), 'password123'),
      '3-20',
      '應拋出用戶名長度錯誤'
    )
  })

  await testAsync('無效用戶名格式應失敗 - 包含非法字元', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('user@name', 'password123'),
      '小寫字母、數字和底線',
      '應拋出用戶名格式錯誤'
    )
  })

  await testAsync('無效用戶名格式應失敗 - 包含空格', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('user name', 'password123'),
      '小寫字母、數字和底線',
      '應拋出用戶名格式錯誤'
    )
  })

  await testAsync('無效用戶名格式應失敗 - 包含大寫（會自動轉小寫）', async () => {
    const service = createFreshUserService()
    // 大寫會被轉為小寫，所以這個應該成功
    const user = await service.register('UserName', 'password123')
    assertEqual(user.username, 'username', '用戶名應被轉為小寫')
  })

  await testAsync('密碼太短應失敗', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('validuser', '12345'),
      '6 個字元',
      '應拋出密碼長度錯誤'
    )
  })

  await testAsync('空密碼應失敗', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('validuser', ''),
      '必填',
      '應拋出密碼必填錯誤'
    )
  })

  await testAsync('displayName 可選 - 未提供時使用 username', async () => {
    const service = createFreshUserService()
    const user = await service.register('optionalname', 'password123')
    assertEqual(user.displayName, 'optionalname', '未提供 displayName 時應使用 username')
  })

  await testAsync('displayName 可選 - 提供 null 時使用 username', async () => {
    const service = createFreshUserService()
    const user = await service.register('nullname', 'password123', null)
    assertEqual(user.displayName, 'nullname', '提供 null 時應使用 username')
  })

  await testAsync('註冊後應有預設頭像', async () => {
    const service = createFreshUserService()
    const user = await service.register('avataruser', 'password123', 'Avatar User')

    assertDefined(user.avatar, '應有頭像 URL')
    assertTrue(user.avatar.includes('ui-avatars.com'), '應使用 UI Avatars 服務')
    assertTrue(user.avatar.includes('Avatar%20User'), '頭像應包含用戶名稱')
  })

  await testAsync('註冊後應有初始統計數據', async () => {
    const service = createFreshUserService()
    const user = await service.register('statsuser', 'password123')

    assertDefined(user.stats, '應有 stats 物件')
    assertEqual(user.stats.watchCount, 0, '觀看次數應為 0')
    assertEqual(user.stats.watchTimeSeconds, 0, '觀看時間應為 0')
    assertNull(user.stats.favoriteGenre, 'favoriteGenre 應為 null')
  })

  await testAsync('註冊後應有 createdAt 和 updatedAt', async () => {
    const service = createFreshUserService()
    const beforeTime = new Date().toISOString()
    const user = await service.register('timeuser', 'password123')
    const afterTime = new Date().toISOString()

    assertDefined(user.createdAt, '應有 createdAt')
    assertDefined(user.updatedAt, '應有 updatedAt')

    // 驗證時間在合理範圍內
    assertTrue(user.createdAt >= beforeTime, 'createdAt 應在測試開始之後')
    assertTrue(user.createdAt <= afterTime, 'createdAt 應在測試結束之前')
  })

  await testAsync('空用戶名應失敗', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('', 'password123'),
      '必填',
      '應拋出用戶名必填錯誤'
    )
  })

  await testAsync('用戶名只有空格應失敗', async () => {
    const service = createFreshUserService()
    await assertThrowsAsync(
      async () => await service.register('   ', 'password123'),
      '3-20',
      '應拋出用戶名錯誤（空格被 trim 後變空）'
    )
  })
}

/**
 * 測試用戶登入功能
 */
async function testUserLogin() {
  console.log('\n=== 用戶登入測試 ===')

  await testAsync('正確帳密應成功登入', async () => {
    const service = createFreshUserService()
    await service.register('loginuser', 'correctpassword')

    const user = await service.login('loginuser', 'correctpassword')

    assertDefined(user, '應返回用戶')
    assertEqual(user.username, 'loginuser', '用戶名應正確')
  })

  await testAsync('錯誤密碼應失敗', async () => {
    const service = createFreshUserService()
    await service.register('loginuser2', 'correctpassword')

    await assertThrowsAsync(
      async () => await service.login('loginuser2', 'wrongpassword'),
      '用戶名或密碼錯誤',
      '應拋出登入錯誤'
    )
  })

  await testAsync('不存在的用戶應失敗', async () => {
    const service = createFreshUserService()

    await assertThrowsAsync(
      async () => await service.login('nonexistent', 'anypassword'),
      '用戶名或密碼錯誤',
      '應拋出登入錯誤'
    )
  })

  await testAsync('登入應返回用戶資料（不含密碼）', async () => {
    const service = createFreshUserService()
    await service.register('secureuser', 'mypassword')

    const user = await service.login('secureuser', 'mypassword')

    assertNotContains(user, 'passwordHash', '不應包含 passwordHash')
    assertNotContains(user, 'passwordSalt', '不應包含 passwordSalt')
    assertContains(user, '_id', '應包含 _id')
    assertContains(user, 'username', '應包含 username')
    assertContains(user, 'displayName', '應包含 displayName')
  })

  await testAsync('登入用戶名不區分大小寫', async () => {
    const service = createFreshUserService()
    await service.register('caseuser', 'password123')

    // 使用大寫登入
    const user = await service.login('CaseUser', 'password123')
    assertEqual(user.username, 'caseuser', '用戶名應為小寫')
  })

  await testAsync('空用戶名登入應失敗', async () => {
    const service = createFreshUserService()

    await assertThrowsAsync(
      async () => await service.login('', 'password'),
      '必填',
      '應拋出必填錯誤'
    )
  })

  await testAsync('空密碼登入應失敗', async () => {
    const service = createFreshUserService()
    await service.register('emptypassuser', 'password123')

    await assertThrowsAsync(
      async () => await service.login('emptypassuser', ''),
      '必填',
      '應拋出必填錯誤'
    )
  })
}

/**
 * 測試查詢用戶功能
 */
async function testUserQuery() {
  console.log('\n=== 查詢用戶測試 ===')

  await testAsync('findById 應返回正確用戶', async () => {
    const service = createFreshUserService()
    const registered = await service.register('findbyiduser', 'password123')

    const found = service.findById(registered._id)

    assertNotNull(found, '應找到用戶')
    assertEqual(found._id, registered._id, 'ID 應相符')
    assertEqual(found.username, 'findbyiduser', '用戶名應正確')
  })

  await testAsync('findById 不存在應返回 null', async () => {
    const service = createFreshUserService()

    const found = service.findById('non-existent-id-12345')

    assertNull(found, '應返回 null')
  })

  await testAsync('findByUsername 應返回正確用戶', async () => {
    const service = createFreshUserService()
    await service.register('findbyname', 'password123', 'Find By Name')

    const found = service.findByUsername('findbyname')

    assertNotNull(found, '應找到用戶')
    assertEqual(found.username, 'findbyname', '用戶名應正確')
    assertEqual(found.displayName, 'Find By Name', '顯示名稱應正確')
  })

  await testAsync('findByUsername 不區分大小寫', async () => {
    const service = createFreshUserService()
    await service.register('caseinsensitive', 'password123')

    const found = service.findByUsername('CaseInsensitive')

    assertNotNull(found, '應找到用戶（大小寫不敏感）')
    assertEqual(found.username, 'caseinsensitive', '用戶名應為小寫')
  })

  await testAsync('findByUsername 不存在應返回 null', async () => {
    const service = createFreshUserService()

    const found = service.findByUsername('nonexistentuser')

    assertNull(found, '應返回 null')
  })

  await testAsync('findByUsername 傳入 null 應返回 null', async () => {
    const service = createFreshUserService()

    const found = service.findByUsername(null)

    assertNull(found, '應返回 null')
  })

  await testAsync('findByUsername 傳入空字串應返回 null', async () => {
    const service = createFreshUserService()

    const found = service.findByUsername('')

    assertNull(found, '應返回 null')
  })

  await testAsync('getAllUsers 應返回所有用戶', async () => {
    const service = createFreshUserService()
    await service.register('user1', 'password123')
    await service.register('user2', 'password123')
    await service.register('user3', 'password123')

    const allUsers = service.getAllUsers()

    assertEqual(allUsers.length, 3, '應有 3 個用戶')
  })

  await testAsync('getAllUsers 不應包含密碼', async () => {
    const service = createFreshUserService()
    await service.register('secureuser1', 'password123')

    const allUsers = service.getAllUsers()

    for (const user of allUsers) {
      assertNotContains(user, 'passwordHash', '不應包含 passwordHash')
      assertNotContains(user, 'passwordSalt', '不應包含 passwordSalt')
    }
  })

  await testAsync('getAllUsers 應返回基本資訊', async () => {
    const service = createFreshUserService()
    await service.register('infouser', 'password123', 'Info User')

    const allUsers = service.getAllUsers()
    const user = allUsers.find(u => u.username === 'infouser')

    assertContains(user, '_id', '應包含 _id')
    assertContains(user, 'username', '應包含 username')
    assertContains(user, 'displayName', '應包含 displayName')
    assertContains(user, 'avatar', '應包含 avatar')
  })

  await testAsync('getAllUsers 無用戶時應返回空陣列', async () => {
    const service = createFreshUserService()

    const allUsers = service.getAllUsers()

    assertTrue(Array.isArray(allUsers), '應為陣列')
    assertEqual(allUsers.length, 0, '應為空陣列')
  })
}

/**
 * 測試更新個人檔案功能
 */
async function testUpdateProfile() {
  console.log('\n=== 更新個人檔案測試 ===')

  await testAsync('更新 displayName 應成功', async () => {
    const service = createFreshUserService()
    const user = await service.register('profileuser', 'password123', 'Old Name')

    const updated = service.updateProfile(user._id, { displayName: 'New Name' })

    assertEqual(updated.displayName, 'New Name', '顯示名稱應更新')
  })

  await testAsync('更新 avatar 應成功', async () => {
    const service = createFreshUserService()
    const user = await service.register('avataruser2', 'password123')

    const newAvatar = 'https://example.com/avatar.png'
    const updated = service.updateProfile(user._id, { avatar: newAvatar })

    assertEqual(updated.avatar, newAvatar, '頭像應更新')
  })

  await testAsync('更新 avatar 支援 data URI', async () => {
    const service = createFreshUserService()
    const user = await service.register('dataavatar', 'password123')

    const dataAvatar = 'data:image/png;base64,iVBORw0KGgo='
    const updated = service.updateProfile(user._id, { avatar: dataAvatar })

    assertEqual(updated.avatar, dataAvatar, '頭像應支援 data URI')
  })

  await testAsync('不存在的用戶應失敗', async () => {
    const service = createFreshUserService()

    assertThrows(
      () => service.updateProfile('nonexistent-id', { displayName: 'New' }),
      '用戶不存在',
      '應拋出用戶不存在錯誤'
    )
  })

  await testAsync('不應允許更新 username', async () => {
    const service = createFreshUserService()
    const user = await service.register('nousernamechange', 'password123')

    const updated = service.updateProfile(user._id, {
      username: 'newusername',
      displayName: 'Valid Change'
    })

    assertEqual(updated.username, 'nousernamechange', 'username 不應改變')
    assertEqual(updated.displayName, 'Valid Change', 'displayName 應改變')
  })

  await testAsync('不應允許更新 passwordHash', async () => {
    const service = createFreshUserService()
    const user = await service.register('nopasschange', 'password123')

    // 嘗試透過 updateProfile 更新密碼
    service.updateProfile(user._id, {
      passwordHash: 'new-malicious-hash',
      displayName: 'Valid'
    })

    // 原密碼應該仍然有效
    const loginResult = await service.login('nopasschange', 'password123')
    assertNotNull(loginResult, '原密碼應仍有效')
  })

  await testAsync('更新後 updatedAt 應改變', async () => {
    const service = createFreshUserService()
    const user = await service.register('updatetime', 'password123')
    const originalUpdatedAt = user.updatedAt

    // 等待一點時間確保時間戳不同
    await new Promise(resolve => setTimeout(resolve, 10))

    const updated = service.updateProfile(user._id, { displayName: 'Changed' })

    assertTrue(updated.updatedAt > originalUpdatedAt, 'updatedAt 應更新')
  })

  await testAsync('displayName 太長應被忽略', async () => {
    const service = createFreshUserService()
    const user = await service.register('longname', 'password123', 'Original')

    // 嘗試設定超過 50 字元的名稱
    const updated = service.updateProfile(user._id, {
      displayName: 'a'.repeat(51)
    })

    assertEqual(updated.displayName, 'Original', '過長的名稱應被忽略')
  })

  await testAsync('空 displayName 應被忽略', async () => {
    const service = createFreshUserService()
    const user = await service.register('emptyname', 'password123', 'Original')

    const updated = service.updateProfile(user._id, {
      displayName: ''
    })

    assertEqual(updated.displayName, 'Original', '空名稱應被忽略')
  })

  await testAsync('無效的 avatar URL 應被忽略', async () => {
    const service = createFreshUserService()
    const user = await service.register('invalidavatar', 'password123')
    const originalAvatar = user.avatar

    const updated = service.updateProfile(user._id, {
      avatar: 'not-a-valid-url'
    })

    assertEqual(updated.avatar, originalAvatar, '無效 URL 應被忽略')
  })
}

/**
 * 測試變更密碼功能
 */
async function testChangePassword() {
  console.log('\n=== 變更密碼測試 ===')

  await testAsync('正確舊密碼應成功變更', async () => {
    const service = createFreshUserService()
    const user = await service.register('changepassuser', 'oldpassword')

    const result = await service.changePassword(user._id, 'oldpassword', 'newpassword')

    assertTrue(result, '應成功變更密碼')
  })

  await testAsync('錯誤舊密碼應失敗', async () => {
    const service = createFreshUserService()
    const user = await service.register('wrongoldpass', 'correctold')

    await assertThrowsAsync(
      async () => await service.changePassword(user._id, 'wrongold', 'newpassword'),
      '目前密碼錯誤',
      '應拋出密碼錯誤'
    )
  })

  await testAsync('新密碼太短應失敗', async () => {
    const service = createFreshUserService()
    const user = await service.register('shortpass', 'oldpassword')

    await assertThrowsAsync(
      async () => await service.changePassword(user._id, 'oldpassword', '12345'),
      '6 個字元',
      '應拋出新密碼長度錯誤'
    )
  })

  await testAsync('變更後應能用新密碼登入', async () => {
    const service = createFreshUserService()
    const user = await service.register('newlogin', 'oldpassword')

    await service.changePassword(user._id, 'oldpassword', 'newpassword')

    // 用新密碼登入
    const loggedIn = await service.login('newlogin', 'newpassword')
    assertNotNull(loggedIn, '應能用新密碼登入')
  })

  await testAsync('變更後舊密碼應無法登入', async () => {
    const service = createFreshUserService()
    const user = await service.register('oldloginfail', 'oldpassword')

    await service.changePassword(user._id, 'oldpassword', 'newpassword')

    // 用舊密碼登入應失敗
    await assertThrowsAsync(
      async () => await service.login('oldloginfail', 'oldpassword'),
      '用戶名或密碼錯誤',
      '舊密碼應無法登入'
    )
  })

  await testAsync('不存在的用戶變更密碼應失敗', async () => {
    const service = createFreshUserService()

    await assertThrowsAsync(
      async () => await service.changePassword('nonexistent-id', 'old', 'new'),
      '用戶不存在',
      '應拋出用戶不存在錯誤'
    )
  })

  await testAsync('空新密碼應失敗', async () => {
    const service = createFreshUserService()
    const user = await service.register('emptypass', 'oldpassword')

    await assertThrowsAsync(
      async () => await service.changePassword(user._id, 'oldpassword', ''),
      '6 個字元',
      '應拋出密碼長度錯誤'
    )
  })
}

/**
 * 測試刪除帳戶功能
 */
async function testDeleteAccount() {
  console.log('\n=== 刪除帳戶測試 ===')

  await testAsync('刪除存在的用戶應成功', async () => {
    const service = createFreshUserService()
    const user = await service.register('deleteuser', 'password123')

    const result = service.deleteAccount(user._id)

    assertTrue(result, '刪除應成功')
  })

  await testAsync('刪除後應無法查詢', async () => {
    const service = createFreshUserService()
    const user = await service.register('deletequery', 'password123')
    const userId = user._id

    service.deleteAccount(userId)

    const found = service.findById(userId)
    assertNull(found, '刪除後應無法找到用戶')
  })

  await testAsync('刪除後應無法用用戶名查詢', async () => {
    const service = createFreshUserService()
    await service.register('deletename', 'password123')

    const user = service.findByUsername('deletename')
    service.deleteAccount(user._id)

    const found = service.findByUsername('deletename')
    assertNull(found, '刪除後應無法用用戶名找到用戶')
  })

  await testAsync('刪除不存在的用戶應拋出錯誤', async () => {
    const service = createFreshUserService()

    assertThrows(
      () => service.deleteAccount('nonexistent-id-12345'),
      '用戶不存在',
      '應拋出用戶不存在錯誤'
    )
  })

  await testAsync('刪除後 getAllUsers 應減少', async () => {
    const service = createFreshUserService()
    await service.register('delcount1', 'password123')
    const user2 = await service.register('delcount2', 'password123')
    await service.register('delcount3', 'password123')

    assertEqual(service.getAllUsers().length, 3, '應有 3 個用戶')

    service.deleteAccount(user2._id)

    assertEqual(service.getAllUsers().length, 2, '刪除後應有 2 個用戶')
  })

  await testAsync('刪除後應無法登入', async () => {
    const service = createFreshUserService()
    const user = await service.register('deletelogin', 'password123')

    service.deleteAccount(user._id)

    await assertThrowsAsync(
      async () => await service.login('deletelogin', 'password123'),
      '用戶名或密碼錯誤',
      '刪除後應無法登入'
    )
  })
}

/**
 * 測試統計更新功能
 */
async function testUpdateStats() {
  console.log('\n=== 更新統計測試 ===')

  await testAsync('updateStats 應正確更新觀看次數', async () => {
    const service = createFreshUserService()
    const user = await service.register('statscount', 'password123')

    const updated = service.updateStats(user._id, { watchCount: 5 })

    assertEqual(updated.stats.watchCount, 5, '觀看次數應為 5')
  })

  await testAsync('updateStats 應累加觀看次數', async () => {
    const service = createFreshUserService()
    const user = await service.register('statsadd', 'password123')

    service.updateStats(user._id, { watchCount: 3 })
    const updated = service.updateStats(user._id, { watchCount: 2 })

    assertEqual(updated.stats.watchCount, 5, '觀看次數應累加為 5')
  })

  await testAsync('updateStats 應正確更新觀看時間', async () => {
    const service = createFreshUserService()
    const user = await service.register('statstime', 'password123')

    const updated = service.updateStats(user._id, { watchTimeSeconds: 3600 })

    assertEqual(updated.stats.watchTimeSeconds, 3600, '觀看時間應為 3600 秒')
  })

  await testAsync('updateStats 應累加觀看時間', async () => {
    const service = createFreshUserService()
    const user = await service.register('statstimeadd', 'password123')

    service.updateStats(user._id, { watchTimeSeconds: 1000 })
    const updated = service.updateStats(user._id, { watchTimeSeconds: 500 })

    assertEqual(updated.stats.watchTimeSeconds, 1500, '觀看時間應累加為 1500 秒')
  })

  await testAsync('updateStats 應正確更新 favoriteGenre', async () => {
    const service = createFreshUserService()
    const user = await service.register('statsgenre', 'password123')

    const updated = service.updateStats(user._id, { favoriteGenre: 'Music' })

    assertEqual(updated.stats.favoriteGenre, 'Music', 'favoriteGenre 應為 Music')
  })

  await testAsync('部分更新應保留其他欄位', async () => {
    const service = createFreshUserService()
    const user = await service.register('statspartial', 'password123')

    // 先設定一些統計
    service.updateStats(user._id, { watchCount: 10, watchTimeSeconds: 500 })

    // 只更新 favoriteGenre
    const updated = service.updateStats(user._id, { favoriteGenre: 'Gaming' })

    assertEqual(updated.stats.watchCount, 10, 'watchCount 應保留')
    assertEqual(updated.stats.watchTimeSeconds, 500, 'watchTimeSeconds 應保留')
    assertEqual(updated.stats.favoriteGenre, 'Gaming', 'favoriteGenre 應更新')
  })

  await testAsync('updateStats 不存在的用戶應失敗', async () => {
    const service = createFreshUserService()

    assertThrows(
      () => service.updateStats('nonexistent-id', { watchCount: 1 }),
      '用戶不存在',
      '應拋出用戶不存在錯誤'
    )
  })

  await testAsync('updateStats 應更新 updatedAt', async () => {
    const service = createFreshUserService()
    const user = await service.register('statsupdated', 'password123')
    const originalUpdatedAt = user.updatedAt

    await new Promise(resolve => setTimeout(resolve, 10))

    const updated = service.updateStats(user._id, { watchCount: 1 })

    assertTrue(updated.updatedAt > originalUpdatedAt, 'updatedAt 應更新')
  })

  await testAsync('updateStats 不應包含敏感資訊', async () => {
    const service = createFreshUserService()
    const user = await service.register('statssafe', 'password123')

    const updated = service.updateStats(user._id, { watchCount: 1 })

    assertNotContains(updated, 'passwordHash', '不應包含 passwordHash')
    assertNotContains(updated, 'passwordSalt', '不應包含 passwordSalt')
  })
}

/**
 * 測試資料持久化
 */
async function testPersistence() {
  console.log('\n=== 資料持久化測試 ===')

  await testAsync('reload 應重新載入資料', async () => {
    const service1 = createFreshUserService()
    await service1.register('persistuser', 'password123')

    // 建立新實例並 reload
    const service2 = new UserService()
    service2.reload()

    const found = service2.findByUsername('persistuser')
    assertNotNull(found, '應能在新實例中找到用戶')
  })

  await testAsync('save 應持久化變更', async () => {
    const service = createFreshUserService()
    const user = await service.register('saveuser', 'password123')

    service.updateProfile(user._id, { displayName: 'Saved Name' })

    // 重新載入並驗證
    service.reload()
    const found = service.findById(user._id)

    assertEqual(found.displayName, 'Saved Name', '變更應被持久化')
  })
}

// === 執行測試 ===

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           UserService 單元測試                               ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  const startTime = Date.now()

  // 設定環境
  cleanupTestDir()

  try {
    // 執行所有測試套件
    await testUtilityFunctions()
    await testUserRegistration()
    await testUserLogin()
    await testUserQuery()
    await testUpdateProfile()
    await testChangePassword()
    await testDeleteAccount()
    await testUpdateStats()
    await testPersistence()
  } finally {
    // 清理測試環境
    cleanupTestDir()
  }

  const duration = Date.now() - startTime

  // 輸出結果
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║                    測試結果                                  ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  通過: ${String(results.passed).padEnd(52)} ║`)
  console.log(`║  失敗: ${String(results.failed).padEnd(52)} ║`)
  console.log(`║  跳過: ${String(results.skipped).padEnd(52)} ║`)
  console.log(`║  總計: ${String(results.passed + results.failed + results.skipped).padEnd(52)} ║`)
  console.log(`║  耗時: ${String(duration + 'ms').padEnd(52)} ║`)
  console.log('╚══════════════════════════════════════════════════════════════╝')

  if (results.failed > 0) {
    console.log('\n\x1b[31m失敗的測試:\x1b[0m')
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`))
    process.exit(1)
  } else {
    console.log('\n\x1b[32m所有測試通過!\x1b[0m')
    process.exit(0)
  }
}

// 執行
runAllTests().catch(error => {
  console.error('測試執行失敗:', error)
  process.exit(1)
})
