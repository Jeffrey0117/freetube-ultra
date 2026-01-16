/**
 * 認證工具模組
 * 處理密碼雜湊、驗證、用戶名驗證等
 */

// 使用 Node.js 內建 crypto 模組（不需要安裝 bcrypt）
const crypto = require('crypto')

// ============================================================================
// 常數定義
// ============================================================================

/**
 * 用戶名規則
 */
const USERNAME_RULES = {
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-zA-Z0-9_-]+$/,
  reserved: ['admin', 'system', 'root', 'guest', 'anonymous']
}

/**
 * 密碼規則
 */
const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128
}

/**
 * PBKDF2 參數
 */
const PBKDF2_CONFIG = {
  iterations: 100000,
  keylen: 64,
  digest: 'sha512',
  saltLength: 32
}

/**
 * 預設頭像列表
 */
const DEFAULT_AVATARS = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5']

// ============================================================================
// 密碼雜湊函數
// ============================================================================

/**
 * 非同步密碼雜湊（使用 PBKDF2）
 * @param {string} password - 原始密碼
 * @returns {Promise<string>} - 格式為 `${salt}:${hash}` 的雜湊字串
 */
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    // 生成隨機鹽值
    const salt = crypto.randomBytes(PBKDF2_CONFIG.saltLength).toString('hex')

    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_CONFIG.iterations,
      PBKDF2_CONFIG.keylen,
      PBKDF2_CONFIG.digest,
      (err, derivedKey) => {
        if (err) {
          reject(err)
          return
        }
        // 返回格式：salt:hash
        resolve(`${salt}:${derivedKey.toString('hex')}`)
      }
    )
  })
}

/**
 * 同步密碼雜湊（使用 PBKDF2）
 * 注意：同步操作會阻塞事件循環，建議優先使用非同步版本
 * @param {string} password - 原始密碼
 * @returns {string} - 格式為 `${salt}:${hash}` 的雜湊字串
 */
function hashPasswordSync(password) {
  // 生成隨機鹽值
  const salt = crypto.randomBytes(PBKDF2_CONFIG.saltLength).toString('hex')

  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_CONFIG.iterations,
    PBKDF2_CONFIG.keylen,
    PBKDF2_CONFIG.digest
  )

  // 返回格式：salt:hash
  return `${salt}:${derivedKey.toString('hex')}`
}

// ============================================================================
// 密碼驗證函數
// ============================================================================

/**
 * 非同步密碼驗證
 * @param {string} password - 要驗證的密碼
 * @param {string} storedHash - 儲存的雜湊值（格式：salt:hash）
 * @returns {Promise<boolean>} - 密碼是否正確
 */
async function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    // 解析儲存的雜湊值
    const parts = storedHash.split(':')
    if (parts.length !== 2) {
      resolve(false)
      return
    }

    const [salt, hash] = parts

    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_CONFIG.iterations,
      PBKDF2_CONFIG.keylen,
      PBKDF2_CONFIG.digest,
      (err, derivedKey) => {
        if (err) {
          reject(err)
          return
        }
        // 使用時間恆定比較防止計時攻擊
        const derivedHash = derivedKey.toString('hex')
        const isValid = crypto.timingSafeEqual(
          Buffer.from(hash, 'hex'),
          Buffer.from(derivedHash, 'hex')
        )
        resolve(isValid)
      }
    )
  })
}

/**
 * 同步密碼驗證
 * 注意：同步操作會阻塞事件循環，建議優先使用非同步版本
 * @param {string} password - 要驗證的密碼
 * @param {string} storedHash - 儲存的雜湊值（格式：salt:hash）
 * @returns {boolean} - 密碼是否正確
 */
function verifyPasswordSync(password, storedHash) {
  // 解析儲存的雜湊值
  const parts = storedHash.split(':')
  if (parts.length !== 2) {
    return false
  }

  const [salt, hash] = parts

  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_CONFIG.iterations,
    PBKDF2_CONFIG.keylen,
    PBKDF2_CONFIG.digest
  )

  // 使用時間恆定比較防止計時攻擊
  const derivedHash = derivedKey.toString('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(derivedHash, 'hex')
    )
  } catch {
    return false
  }
}

// ============================================================================
// 用戶名驗證
// ============================================================================

/**
 * 驗證用戶名是否符合規則
 * @param {string} username - 要驗證的用戶名
 * @returns {{ valid: boolean, error?: string }} - 驗證結果
 */
function validateUsername(username) {
  // 檢查是否為空或非字串
  if (!username || typeof username !== 'string') {
    return {
      valid: false,
      error: '用戶名不能為空'
    }
  }

  const trimmed = username.trim()

  // 檢查最小長度
  if (trimmed.length < USERNAME_RULES.minLength) {
    return {
      valid: false,
      error: `用戶名至少需要 ${USERNAME_RULES.minLength} 個字元`
    }
  }

  // 檢查最大長度
  if (trimmed.length > USERNAME_RULES.maxLength) {
    return {
      valid: false,
      error: `用戶名不能超過 ${USERNAME_RULES.maxLength} 個字元`
    }
  }

  // 檢查字元模式（只允許英文字母、數字、底線、連字號）
  if (!USERNAME_RULES.pattern.test(trimmed)) {
    return {
      valid: false,
      error: '用戶名只能包含英文字母、數字、底線和連字號'
    }
  }

  // 檢查保留名稱
  if (USERNAME_RULES.reserved.includes(trimmed.toLowerCase())) {
    return {
      valid: false,
      error: '此用戶名為系統保留名稱，無法使用'
    }
  }

  return { valid: true }
}

// ============================================================================
// 密碼強度驗證
// ============================================================================

/**
 * 驗證密碼並評估強度
 * @param {string} password - 要驗證的密碼
 * @returns {{ valid: boolean, error?: string, strength: 'weak' | 'medium' | 'strong' }} - 驗證結果
 */
function validatePassword(password) {
  // 檢查是否為空或非字串
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      error: '密碼不能為空',
      strength: 'weak'
    }
  }

  // 檢查最小長度
  if (password.length < PASSWORD_RULES.minLength) {
    return {
      valid: false,
      error: `密碼至少需要 ${PASSWORD_RULES.minLength} 個字元`,
      strength: 'weak'
    }
  }

  // 檢查最大長度
  if (password.length > PASSWORD_RULES.maxLength) {
    return {
      valid: false,
      error: `密碼不能超過 ${PASSWORD_RULES.maxLength} 個字元`,
      strength: 'weak'
    }
  }

  // 評估密碼強度
  let score = 0

  // 長度加分
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1

  // 包含小寫字母
  if (/[a-z]/.test(password)) score += 1

  // 包含大寫字母
  if (/[A-Z]/.test(password)) score += 1

  // 包含數字
  if (/[0-9]/.test(password)) score += 1

  // 包含特殊字元
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score += 1

  // 根據分數決定強度
  let strength
  if (score <= 2) {
    strength = 'weak'
  } else if (score <= 4) {
    strength = 'medium'
  } else {
    strength = 'strong'
  }

  return {
    valid: true,
    strength
  }
}

// ============================================================================
// ID 和 Token 生成
// ============================================================================

/**
 * 生成唯一用戶 ID
 * 格式：user_xxxxxxxxxxxxxxxx（16 個隨機十六進位字元）
 * @returns {string} - 唯一用戶 ID
 */
function generateUserId() {
  const randomPart = crypto.randomBytes(8).toString('hex')
  return `user_${randomPart}`
}

/**
 * 生成會話 Token
 * 使用 64 位元組（128 個十六進位字元）的加密安全隨機值
 * @returns {string} - 會話 Token
 */
function generateSessionToken() {
  return crypto.randomBytes(64).toString('hex')
}

// ============================================================================
// 頭像相關函數
// ============================================================================

/**
 * 隨機選擇一個預設頭像
 * @returns {string} - 頭像名稱（如 'avatar-1'）
 */
function getRandomDefaultAvatar() {
  const index = crypto.randomInt(0, DEFAULT_AVATARS.length)
  return DEFAULT_AVATARS[index]
}

/**
 * 驗證頭像是否有效
 * @param {string} avatar - 頭像名稱或路徑
 * @returns {boolean} - 是否為有效頭像
 */
function isValidAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') {
    return false
  }

  // 檢查是否為預設頭像
  if (DEFAULT_AVATARS.includes(avatar)) {
    return true
  }

  // 檢查是否為自訂頭像路徑（支援常見圖片格式）
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
  const lowerAvatar = avatar.toLowerCase()

  return validExtensions.some(ext => lowerAvatar.endsWith(ext))
}

// ============================================================================
// 匯出
// ============================================================================

module.exports = {
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
}
