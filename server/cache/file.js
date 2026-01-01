/**
 * File Cache - 檔案系統快取實現
 * 使用 JSON 格式儲存到檔案系統
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

class FileCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.cache')
    this.defaultTTL = options.defaultTTL || 60 * 60 * 1000 // 預設 1 小時

    // 統計資訊
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    }

    // 確保快取目錄存在
    this._ensureCacheDir()
  }

  /**
   * 確保快取目錄存在
   * @private
   */
  _ensureCacheDir() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true })
      }
    } catch (error) {
      console.error('[FileCache] Failed to create cache directory:', error.message)
      this.stats.errors++
    }
  }

  /**
   * 將鍵轉換為安全的檔案名
   * @param {string} key - 快取鍵
   * @returns {string} 檔案路徑
   * @private
   */
  _getFilePath(key) {
    // 使用 MD5 hash 作為檔案名，避免特殊字元問題
    const hash = crypto.createHash('md5').update(key).digest('hex')
    return path.join(this.cacheDir, `${hash}.json`)
  }

  /**
   * 非同步取得快取值
   * @param {string} key - 快取鍵
   * @returns {Promise<*>} 快取值或 undefined
   */
  async get(key) {
    const filePath = this._getFilePath(key)

    try {
      if (!fs.existsSync(filePath)) {
        this.stats.misses++
        return undefined
      }

      const content = await fs.promises.readFile(filePath, 'utf8')
      const entry = JSON.parse(content)

      // 檢查是否過期
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key)
        this.stats.misses++
        return undefined
      }

      this.stats.hits++
      return entry.value
    } catch (error) {
      console.error('[FileCache] Read error:', error.message)
      this.stats.errors++
      this.stats.misses++
      return undefined
    }
  }

  /**
   * 同步取得快取值
   * @param {string} key - 快取鍵
   * @returns {*} 快取值或 undefined
   */
  getSync(key) {
    const filePath = this._getFilePath(key)

    try {
      if (!fs.existsSync(filePath)) {
        this.stats.misses++
        return undefined
      }

      const content = fs.readFileSync(filePath, 'utf8')
      const entry = JSON.parse(content)

      // 檢查是否過期
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.deleteSync(key)
        this.stats.misses++
        return undefined
      }

      this.stats.hits++
      return entry.value
    } catch (error) {
      console.error('[FileCache] Read error:', error.message)
      this.stats.errors++
      this.stats.misses++
      return undefined
    }
  }

  /**
   * 非同步設定快取值
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   * @param {Object} options - 選項
   * @param {number} options.ttl - 存活時間（毫秒），0 表示永久
   */
  async set(key, value, options = {}) {
    const filePath = this._getFilePath(key)
    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL

    const entry = {
      key, // 儲存原始 key 以便除錯
      value,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl : null
    }

    try {
      await fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8')
      this.stats.sets++
    } catch (error) {
      console.error('[FileCache] Write error:', error.message)
      this.stats.errors++
    }
  }

  /**
   * 同步設定快取值
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   * @param {Object} options - 選項
   */
  setSync(key, value, options = {}) {
    const filePath = this._getFilePath(key)
    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL

    const entry = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl : null
    }

    try {
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8')
      this.stats.sets++
    } catch (error) {
      console.error('[FileCache] Write error:', error.message)
      this.stats.errors++
    }
  }

  /**
   * 非同步刪除快取項目
   * @param {string} key - 快取鍵
   * @returns {Promise<boolean>} 是否成功刪除
   */
  async delete(key) {
    const filePath = this._getFilePath(key)

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath)
        this.stats.deletes++
        return true
      }
      return false
    } catch (error) {
      console.error('[FileCache] Delete error:', error.message)
      this.stats.errors++
      return false
    }
  }

  /**
   * 同步刪除快取項目
   * @param {string} key - 快取鍵
   * @returns {boolean} 是否成功刪除
   */
  deleteSync(key) {
    const filePath = this._getFilePath(key)

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        this.stats.deletes++
        return true
      }
      return false
    } catch (error) {
      console.error('[FileCache] Delete error:', error.message)
      this.stats.errors++
      return false
    }
  }

  /**
   * 清除所有快取
   * @returns {Promise<number>} 清除的檔案數
   */
  async clear() {
    try {
      const files = await fs.promises.readdir(this.cacheDir)
      let cleared = 0

      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.promises.unlink(path.join(this.cacheDir, file))
          cleared++
        }
      }

      return cleared
    } catch (error) {
      console.error('[FileCache] Clear error:', error.message)
      this.stats.errors++
      return 0
    }
  }

  /**
   * 清理過期項目
   * @returns {Promise<number>} 清除的檔案數
   */
  async cleanupExpired() {
    try {
      const files = await fs.promises.readdir(this.cacheDir)
      const now = Date.now()
      let cleaned = 0

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const filePath = path.join(this.cacheDir, file)
        try {
          const content = await fs.promises.readFile(filePath, 'utf8')
          const entry = JSON.parse(content)

          if (entry.expiresAt && now > entry.expiresAt) {
            await fs.promises.unlink(filePath)
            cleaned++
          }
        } catch (e) {
          // 忽略個別檔案錯誤
        }
      }

      return cleaned
    } catch (error) {
      console.error('[FileCache] Cleanup error:', error.message)
      this.stats.errors++
      return 0
    }
  }

  /**
   * 取得快取大小（檔案數）
   * @returns {Promise<number>}
   */
  async size() {
    try {
      const files = await fs.promises.readdir(this.cacheDir)
      return files.filter(f => f.endsWith('.json')).length
    } catch (error) {
      return 0
    }
  }

  /**
   * 取得統計資訊
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      cacheDir: this.cacheDir,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%'
    }
  }
}

module.exports = FileCache
