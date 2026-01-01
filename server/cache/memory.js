/**
 * Memory Cache - 記憶體快取實現
 * 使用 Map 儲存，支援 TTL 過期和自動清理
 */

class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map()
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000 // 預設 5 分鐘
    this.maxSize = options.maxSize || 1000 // 最大項目數
    this.cleanupInterval = options.cleanupInterval || 60 * 1000 // 清理間隔 1 分鐘

    // 統計資訊
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    }

    // 啟動自動清理
    this._startCleanup()
  }

  /**
   * 取得快取值
   * @param {string} key - 快取鍵
   * @returns {*} 快取值或 undefined
   */
  get(key) {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // 檢查是否過期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.misses++
      return undefined
    }

    this.stats.hits++
    return entry.value
  }

  /**
   * 設定快取值
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   * @param {Object} options - 選項
   * @param {number} options.ttl - 存活時間（毫秒），0 表示永久
   */
  set(key, value, options = {}) {
    // 如果超過最大容量，先清理過期項目
    if (this.cache.size >= this.maxSize) {
      this._cleanupExpired()

      // 如果還是超過，刪除最舊的項目
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value
        this.cache.delete(firstKey)
      }
    }

    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL
    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl : null // null 表示永久
    }

    this.cache.set(key, entry)
    this.stats.sets++
  }

  /**
   * 刪除快取項目
   * @param {string} key - 快取鍵
   * @returns {boolean} 是否成功刪除
   */
  delete(key) {
    const result = this.cache.delete(key)
    if (result) {
      this.stats.deletes++
    }
    return result
  }

  /**
   * 清除所有快取
   */
  clear() {
    this.cache.clear()
  }

  /**
   * 檢查鍵是否存在且未過期
   * @param {string} key - 快取鍵
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  /**
   * 取得快取大小
   * @returns {number}
   */
  size() {
    return this.cache.size
  }

  /**
   * 取得統計資訊
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%'
    }
  }

  /**
   * 清理過期項目
   * @private
   */
  _cleanupExpired() {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * 啟動自動清理定時器
   * @private
   */
  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      this._cleanupExpired()
    }, this.cleanupInterval)

    // 允許程式正常結束
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref()
    }
  }

  /**
   * 停止自動清理
   */
  stopCleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer)
      this._cleanupTimer = null
    }
  }

  /**
   * 銷毀快取實例
   */
  destroy() {
    this.stopCleanup()
    this.clear()
  }
}

module.exports = MemoryCache
