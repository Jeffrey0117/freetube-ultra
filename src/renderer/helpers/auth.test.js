/**
 * 認證工具模組測試
 * 執行: node src/renderer/helpers/auth.test.js
 */

const {
  // 常數
  USERNAME_RULES,
  PASSWORD_RULES,
  DEFAULT_AVATARS,

  // 密碼雜湊
  hashPassword,
  hashPasswordSync,

  // 密碼驗證
  verifyPassword,
  verifyPasswordSync,

  // 用戶名驗證
  validateUsername,

  // 密碼強度驗證
  validatePassword,

  // ID 和 Token 生成
  generateUserId,
  generateSessionToken,

  // 頭像相關
  getRandomDefaultAvatar,
  isValidAvatar
} = require('./auth')

// ============================================================================
// 測試框架
// ============================================================================

const results = {
  passed: 0,
  failed: 0,
  tests: []
}

/**
 * 同步測試
 * @param {string} name - 測試名稱
 * @param {Function} fn - 測試函數
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
    console.log(`    錯誤: ${error.message}`)
  }
}

/**
 * 非同步測試
 * @param {string} name - 測試名稱
 * @param {Function} fn - 非同步測試函數
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
    console.log(`    錯誤: ${error.message}`)
  }
}

/**
 * 斷言兩值相等
 */
function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || '斷言失敗'}: 預期 ${JSON.stringify(expected)}, 實際 ${JSON.stringify(actual)}`)
  }
}

/**
 * 斷言為真
 */
function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || '預期為 true 但得到 false')
  }
}

/**
 * 斷言為假
 */
function assertFalse(value, message) {
  if (value) {
    throw new Error(message || '預期為 false 但得到 true')
  }
}

/**
 * 斷言符合正規表達式
 */
function assertMatch(value, regex, message) {
  if (!regex.test(value)) {
    throw new Error(message || `值 "${value}" 不符合正規表達式 ${regex}`)
  }
}

/**
 * 斷言不相等
 */
function assertNotEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    throw new Error(`${message || '斷言失敗'}: 值不應相等 ${JSON.stringify(actual)}`)
  }
}

// ============================================================================
// 測試套件
// ============================================================================

/**
 * 密碼雜湊測試
 */
async function testPasswordHashing() {
  console.log('\n=== 密碼雜湊測試 ===')

  // 測試非同步雜湊
  await testAsync('hashPassword 應返回格式正確的雜湊', async () => {
    const hash = await hashPassword('testpassword123')
    // 雜湊格式應為 salt:hash
    const parts = hash.split(':')
    assertEqual(parts.length, 2, '雜湊應包含兩個部分')
    // salt 長度應為 64 個十六進位字元（32 bytes）
    assertEqual(parts[0].length, 64, 'salt 長度應為 64')
    // hash 長度應為 128 個十六進位字元（64 bytes）
    assertEqual(parts[1].length, 128, 'hash 長度應為 128')
  })

  // 測試同步雜湊
  test('hashPasswordSync 應返回格式正確的雜湊', () => {
    const hash = hashPasswordSync('testpassword456')
    const parts = hash.split(':')
    assertEqual(parts.length, 2, '雜湊應包含兩個部分')
    assertEqual(parts[0].length, 64, 'salt 長度應為 64')
    assertEqual(parts[1].length, 128, 'hash 長度應為 128')
  })

  // 測試隨機鹽值
  await testAsync('相同密碼應產生不同的雜湊（隨機 salt）', async () => {
    const password = 'samepassword'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    assertNotEqual(hash1, hash2, '相同密碼的雜湊應不同')
  })

  // 測試同步隨機鹽值
  test('hashPasswordSync 相同密碼應產生不同雜湊', () => {
    const password = 'samepassword'
    const hash1 = hashPasswordSync(password)
    const hash2 = hashPasswordSync(password)
    assertNotEqual(hash1, hash2, '相同密碼的雜湊應不同')
  })

  // 測試雜湊格式
  test('雜湊格式應為 salt:hash', () => {
    const hash = hashPasswordSync('formattest')
    assertMatch(hash, /^[a-f0-9]{64}:[a-f0-9]{128}$/, '雜湊格式不正確')
  })
}

/**
 * 密碼驗證測試
 */
async function testPasswordVerification() {
  console.log('\n=== 密碼驗證測試 ===')

  // 準備測試用雜湊
  const correctPassword = 'correctpassword123'
  const wrongPassword = 'wrongpassword456'
  const storedHash = hashPasswordSync(correctPassword)

  // 非同步驗證 - 正確密碼
  await testAsync('verifyPassword 正確密碼應返回 true', async () => {
    const isValid = await verifyPassword(correctPassword, storedHash)
    assertTrue(isValid, '正確密碼驗證應通過')
  })

  // 非同步驗證 - 錯誤密碼
  await testAsync('verifyPassword 錯誤密碼應返回 false', async () => {
    const isValid = await verifyPassword(wrongPassword, storedHash)
    assertFalse(isValid, '錯誤密碼驗證應失敗')
  })

  // 同步驗證 - 正確密碼
  test('verifyPasswordSync 正確密碼應返回 true', () => {
    const isValid = verifyPasswordSync(correctPassword, storedHash)
    assertTrue(isValid, '正確密碼驗證應通過')
  })

  // 同步驗證 - 錯誤密碼
  test('verifyPasswordSync 錯誤密碼應返回 false', () => {
    const isValid = verifyPasswordSync(wrongPassword, storedHash)
    assertFalse(isValid, '錯誤密碼驗證應失敗')
  })

  // 空密碼驗證
  await testAsync('空密碼應返回 false', async () => {
    const isValid = await verifyPassword('', storedHash)
    assertFalse(isValid, '空密碼驗證應失敗')
  })

  // 無效雜湊格式
  test('無效雜湊格式應返回 false', () => {
    // 缺少冒號分隔符
    const isValid1 = verifyPasswordSync('test', 'invalidhash')
    assertFalse(isValid1, '無效雜湊格式應失敗')

    // 太多冒號
    const isValid2 = verifyPasswordSync('test', 'a:b:c')
    assertFalse(isValid2, '太多冒號的雜湊應失敗')
  })

  // 非同步無效雜湊格式
  await testAsync('verifyPassword 無效雜湊格式應返回 false', async () => {
    const isValid = await verifyPassword('test', 'invalidhash')
    assertFalse(isValid, '無效雜湊格式應失敗')
  })
}

/**
 * 用戶名驗證測試
 */
function testUsernameValidation() {
  console.log('\n=== 用戶名驗證測試 ===')

  // 有效用戶名
  test('有效用戶名應通過驗證', () => {
    const validNames = ['john', 'user123', 'test_user', 'my-name', 'ABC123']
    for (const name of validNames) {
      const result = validateUsername(name)
      assertTrue(result.valid, `用戶名 "${name}" 應有效`)
    }
  })

  // 太短的用戶名
  test('太短的用戶名應失敗', () => {
    const result = validateUsername('ab')
    assertFalse(result.valid, '2 個字元的用戶名應失敗')
    assertTrue(result.error.includes('至少需要'), '應包含正確錯誤訊息')
  })

  // 太長的用戶名
  test('太長的用戶名應失敗', () => {
    const longName = 'a'.repeat(21)
    const result = validateUsername(longName)
    assertFalse(result.valid, '21 個字元的用戶名應失敗')
    assertTrue(result.error.includes('不能超過'), '應包含正確錯誤訊息')
  })

  // 包含非法字元
  test('包含非法字元應失敗', () => {
    const invalidNames = ['user@name', 'test name', 'name!', '用戶名', 'user.name']
    for (const name of invalidNames) {
      const result = validateUsername(name)
      assertFalse(result.valid, `用戶名 "${name}" 應無效`)
    }
  })

  // 保留名稱
  test('保留名稱應失敗 (admin, root, guest 等)', () => {
    const reservedNames = ['admin', 'system', 'root', 'guest', 'anonymous', 'ADMIN', 'Root']
    for (const name of reservedNames) {
      const result = validateUsername(name)
      assertFalse(result.valid, `保留名稱 "${name}" 應失敗`)
      assertTrue(result.error.includes('保留名稱'), '應包含正確錯誤訊息')
    }
  })

  // 空用戶名
  test('空用戶名應失敗', () => {
    const emptyValues = ['', null, undefined, '   ']
    for (const value of emptyValues) {
      const result = validateUsername(value)
      assertFalse(result.valid, `空值 "${value}" 應失敗`)
    }
  })

  // 邊界值測試
  test('邊界長度的用戶名', () => {
    // 最小長度
    const minName = 'abc'
    const minResult = validateUsername(minName)
    assertTrue(minResult.valid, '最小長度（3）用戶名應有效')

    // 最大長度
    const maxName = 'a'.repeat(20)
    const maxResult = validateUsername(maxName)
    assertTrue(maxResult.valid, '最大長度（20）用戶名應有效')
  })
}

/**
 * 密碼強度測試
 */
function testPasswordStrength() {
  console.log('\n=== 密碼強度測試 ===')

  // 太短的密碼
  test('太短的密碼應失敗', () => {
    const result = validatePassword('short')
    assertFalse(result.valid, '5 個字元的密碼應失敗')
    assertEqual(result.strength, 'weak', '強度應為 weak')
    assertTrue(result.error.includes('至少需要'), '應包含正確錯誤訊息')
  })

  // 弱密碼
  test('弱密碼應返回 weak', () => {
    // 只有小寫字母，長度 8
    const result = validatePassword('password')
    assertTrue(result.valid, '密碼應有效')
    assertEqual(result.strength, 'weak', '純小寫密碼強度應為 weak')
  })

  // 中等密碼
  test('中等密碼應返回 medium', () => {
    // 包含小寫、大寫、數字
    const result = validatePassword('Password123')
    assertTrue(result.valid, '密碼應有效')
    assertEqual(result.strength, 'medium', '混合密碼強度應為 medium')
  })

  // 強密碼
  test('強密碼應返回 strong', () => {
    // 長度 16+，包含小寫、大寫、數字、特殊字元
    const result = validatePassword('SecureP@ssw0rd!123')
    assertTrue(result.valid, '密碼應有效')
    assertEqual(result.strength, 'strong', '複雜密碼強度應為 strong')
  })

  // 太長的密碼
  test('太長的密碼應失敗', () => {
    const longPassword = 'a'.repeat(129)
    const result = validatePassword(longPassword)
    assertFalse(result.valid, '129 個字元的密碼應失敗')
    assertTrue(result.error.includes('不能超過'), '應包含正確錯誤訊息')
  })

  // 空密碼
  test('空密碼應失敗', () => {
    const emptyValues = ['', null, undefined]
    for (const value of emptyValues) {
      const result = validatePassword(value)
      assertFalse(result.valid, `空密碼 "${value}" 應失敗`)
      assertEqual(result.strength, 'weak', '強度應為 weak')
    }
  })

  // 邊界長度測試
  test('邊界長度的密碼', () => {
    // 最小長度
    const minPassword = 'a'.repeat(8)
    const minResult = validatePassword(minPassword)
    assertTrue(minResult.valid, '最小長度（8）密碼應有效')

    // 最大長度
    const maxPassword = 'a'.repeat(128)
    const maxResult = validatePassword(maxPassword)
    assertTrue(maxResult.valid, '最大長度（128）密碼應有效')
  })

  // 不同強度分數測試
  test('12+ 字元密碼應獲得額外分數', () => {
    // 12 個字元，包含大小寫
    const result = validatePassword('Abcdefghijkl')
    assertTrue(result.valid, '密碼應有效')
    // 長度 12+ (+1) + 小寫 (+1) + 大寫 (+1) = 3，應為 medium
    assertEqual(result.strength, 'medium', '12+ 字元密碼應至少為 medium')
  })
}

/**
 * ID 生成測試
 */
function testIdGeneration() {
  console.log('\n=== ID 生成測試 ===')

  // generateUserId 測試
  test('generateUserId 應返回 user_ 前綴的 ID', () => {
    const userId = generateUserId()
    assertTrue(userId.startsWith('user_'), 'ID 應以 user_ 開頭')
    // user_ + 16 個十六進位字元
    assertEqual(userId.length, 5 + 16, 'ID 總長度應為 21')
  })

  // generateUserId 格式測試
  test('generateUserId 格式應正確', () => {
    const userId = generateUserId()
    assertMatch(userId, /^user_[a-f0-9]{16}$/, 'ID 格式不正確')
  })

  // generateSessionToken 測試
  test('generateSessionToken 應返回 128 字元的 hex', () => {
    const token = generateSessionToken()
    // 64 bytes = 128 個十六進位字元
    assertEqual(token.length, 128, 'Token 長度應為 128')
    assertMatch(token, /^[a-f0-9]{128}$/, 'Token 應為十六進位字串')
  })

  // 唯一性測試
  test('生成的 ID 應唯一', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(generateUserId())
    }
    assertEqual(ids.size, 100, '100 個 ID 應全部唯一')
  })

  // Token 唯一性測試
  test('生成的 Token 應唯一', () => {
    const tokens = new Set()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken())
    }
    assertEqual(tokens.size, 100, '100 個 Token 應全部唯一')
  })
}

/**
 * 頭像測試
 */
function testAvatars() {
  console.log('\n=== 頭像測試 ===')

  // getRandomDefaultAvatar 測試
  test('getRandomDefaultAvatar 應返回有效頭像', () => {
    const avatar = getRandomDefaultAvatar()
    assertTrue(DEFAULT_AVATARS.includes(avatar), `頭像 "${avatar}" 應在預設列表中`)
  })

  // 隨機性測試
  test('getRandomDefaultAvatar 應產生多種頭像', () => {
    const avatars = new Set()
    for (let i = 0; i < 50; i++) {
      avatars.add(getRandomDefaultAvatar())
    }
    assertTrue(avatars.size > 1, '應產生多種不同的頭像')
  })

  // isValidAvatar 預設頭像測試
  test('isValidAvatar 應正確驗證預設頭像', () => {
    for (const avatar of DEFAULT_AVATARS) {
      assertTrue(isValidAvatar(avatar), `預設頭像 "${avatar}" 應有效`)
    }
  })

  // isValidAvatar 圖片路徑測試
  test('isValidAvatar 應接受圖片路徑', () => {
    const validPaths = [
      'custom/avatar.png',
      'user/photo.jpg',
      'image.jpeg',
      'avatar.gif',
      'icon.svg',
      'photo.webp'
    ]
    for (const path of validPaths) {
      assertTrue(isValidAvatar(path), `圖片路徑 "${path}" 應有效`)
    }
  })

  // isValidAvatar 大小寫不敏感
  test('isValidAvatar 應支援大寫副檔名', () => {
    const paths = ['photo.PNG', 'image.JPG', 'avatar.JPEG']
    for (const path of paths) {
      assertTrue(isValidAvatar(path), `大寫副檔名 "${path}" 應有效`)
    }
  })

  // isValidAvatar 無效輸入
  test('isValidAvatar 應拒絕無效輸入', () => {
    const invalidInputs = [
      '',
      null,
      undefined,
      'not-an-image',
      'file.txt',
      'document.pdf',
      'invalid-avatar-99'
    ]
    for (const input of invalidInputs) {
      assertFalse(isValidAvatar(input), `無效輸入 "${input}" 應被拒絕`)
    }
  })
}

/**
 * 常數測試
 */
function testConstants() {
  console.log('\n=== 常數驗證測試 ===')

  test('USERNAME_RULES 應正確定義', () => {
    assertEqual(USERNAME_RULES.minLength, 3, '最小長度應為 3')
    assertEqual(USERNAME_RULES.maxLength, 20, '最大長度應為 20')
    assertTrue(USERNAME_RULES.pattern instanceof RegExp, 'pattern 應為正規表達式')
    assertTrue(Array.isArray(USERNAME_RULES.reserved), 'reserved 應為陣列')
  })

  test('PASSWORD_RULES 應正確定義', () => {
    assertEqual(PASSWORD_RULES.minLength, 8, '最小長度應為 8')
    assertEqual(PASSWORD_RULES.maxLength, 128, '最大長度應為 128')
  })

  test('DEFAULT_AVATARS 應包含預設頭像', () => {
    assertTrue(Array.isArray(DEFAULT_AVATARS), 'DEFAULT_AVATARS 應為陣列')
    assertTrue(DEFAULT_AVATARS.length >= 5, '應至少有 5 個預設頭像')
    assertTrue(DEFAULT_AVATARS.every(a => a.startsWith('avatar-')), '所有頭像應以 avatar- 開頭')
  })
}

// ============================================================================
// 執行測試
// ============================================================================

async function runAllTests() {
  console.log('======================================')
  console.log('       認證工具模組測試')
  console.log('======================================')

  const startTime = Date.now()

  // 執行所有測試套件
  await testPasswordHashing()
  await testPasswordVerification()
  testUsernameValidation()
  testPasswordStrength()
  testIdGeneration()
  testAvatars()
  testConstants()

  const duration = Date.now() - startTime

  console.log('\n======================================')
  console.log('       測試結果')
  console.log('======================================')
  console.log(`  通過: ${results.passed}`)
  console.log(`  失敗: ${results.failed}`)
  console.log(`  總計: ${results.passed + results.failed}`)
  console.log(`  耗時: ${duration}ms`)
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

runAllTests().catch(error => {
  console.error('測試執行失敗:', error)
  process.exit(1)
})
