/**
 * CacheManager - 快取管理器
 * 整合記憶體快取和檔案快取，提供統一的快取介面
 *
 * 快取策略：
 * - 搜尋結果: 5 分鐘 (memory only)
 * - 影片資訊: 1 小時 (memory + file)
 * - 頻道資訊: 24 小時 (memory + file)
 * - 歌詞: 永久 (memory + file)
 */

const MemoryCache = require('./memory')
const FileCache = require('./file')
const path = require('path')

// 快取類型常數
const CACHE_TYPES = {
  SEARCH: 'search',
  VIDEO: 'video',
  CHANNEL: 'channel',
  LYRICS: 'lyrics'
}

// 預設 TTL 設定（毫秒）
const DEFAULT_TTL = {
  [CACHE_TYPES.SEARCH]: 5 * 60 * 1000,        // 5 分鐘
  [CACHE_TYPES.VIDEO]: 60 * 60 * 1000,         // 1 小時
  [CACHE_TYPES.CHANNEL]: 24 * 60 * 60 * 1000,  // 24 小時
  [CACHE_TYPES.LYRICS]: 0                       // 永久（0 表示不過期）
}

// 是否使用檔案快取
const USE_FILE_CACHE = {
  [CACHE_TYPES.SEARCH]: false,  // 搜尋結果只用記憶體
  [CACHE_TYPES.VIDEO]: true,    // 影片資訊使用檔案快取
  [CACHE_TYPES.CHANNEL]: true,  // 頻道資訊使用檔案快取
  [CACHE_TYPES.LYRICS]: true    // 歌詞使用檔案快取
}

class CacheManager {
  /**
   * 建立快取管理器
   * @param {Object} options - 選項
   * @param {string} options.cacheDir - 檔案快取目錄
   * @param {number} options.maxMemorySize - 記憶體快取最大項目數
   * @param {number} options.cleanupInterval - 自動清理間隔（毫秒）
   */
  constructor(options = {}) {
    const defaultCacheDir = path.join(
      process.env.FREETUBE_DATA_PATH || process.cwd(),
      'cache'
    )

    this.options = {
      cacheDir: options.cacheDir || defaultCacheDir,
      maxMemorySize: options.maxMemorySize || 1000,
      cleanupInterval: options.cleanupInterval || 60 * 1000
    }

    // 初始化記憶體快取
    this.memoryCache = new MemoryCache({
      maxSize: this.options.maxMemorySize,
      cleanupInterval: this.options.cleanupInterval
    })

    // 初始化檔案快取
    this.fileCache = new FileCache({
      cacheDir: this.options.cacheDir
    })

    // 統計資訊
    this.stats = {
      totalGets: 0,
      totalSets: 0,
      memoryHits: 0,
      fileHits: 0,
      misses: 0
    }
  }

  /**
   * 產生快取鍵
   * @param {string} type - 快取類型
   * @param {string} id - 識別碼
   * @returns {string}
   * @private
   */
  _generateKey(type, id) {
    return `${type}:${id}`
  }

  /**
   * 取得快取值
   * @param {string} key - 快取鍵
   * @param {Object} options - 選項
   * @param {string} options.type - 快取類型（用於決定是否查詢檔案快取）
   * @returns {Promise<*>} 快取值或 undefined
   */
  async get(key, options = {}) {
    this.stats.totalGets++
    const type = options.type || this._inferType(key)

    // 首先檢查記憶體快取
    const memoryValue = this.memoryCache.get(key)
    if (memoryValue !== undefined) {
      this.stats.memoryHits++
      return memoryValue
    }

    // 如果該類型使用檔案快取，檢查檔案快取
    if (USE_FILE_CACHE[type]) {
      const fileValue = await this.fileCache.get(key)
      if (fileValue !== undefined) {
        this.stats.fileHits++

        // 將檔案快取值回填到記憶體快取
        const ttl = DEFAULT_TTL[type]
        this.memoryCache.set(key, fileValue, { ttl })

        return fileValue
      }
    }

    this.stats.misses++
    return undefined
  }

  /**
   * 同步取得快取值（僅記憶體快取）
   * @param {string} key - 快取鍵
   * @returns {*} 快取值或 undefined
   */
  getSync(key) {
    return this.memoryCache.get(key)
  }

  /**
   * 設定快取值
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   * @param {Object} options - 選項
   * @param {string} options.type - 快取類型
   * @param {number} options.ttl - 自訂 TTL（毫秒）
   */
  async set(key, value, options = {}) {
    this.stats.totalSets++
    const type = options.type || this._inferType(key)
    const ttl = options.ttl !== undefined ? options.ttl : DEFAULT_TTL[type] || DEFAULT_TTL[CACHE_TYPES.VIDEO]

    // 設定記憶體快取
    this.memoryCache.set(key, value, { ttl })

    // 如果該類型使用檔案快取，同時寫入檔案
    if (USE_FILE_CACHE[type]) {
      await this.fileCache.set(key, value, { ttl })
    }
  }

  /**
   * 同步設定快取值（僅記憶體快取）
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   * @param {Object} options - 選項
   */
  setSync(key, value, options = {}) {
    const type = options.type || this._inferType(key)
    const ttl = options.ttl !== undefined ? options.ttl : DEFAULT_TTL[type] || DEFAULT_TTL[CACHE_TYPES.VIDEO]
    this.memoryCache.set(key, value, { ttl })
  }

  /**
   * 刪除快取項目
   * @param {string} key - 快取鍵
   * @param {Object} options - 選項
   */
  async delete(key, options = {}) {
    const type = options.type || this._inferType(key)

    this.memoryCache.delete(key)

    if (USE_FILE_CACHE[type]) {
      await this.fileCache.delete(key)
    }
  }

  /**
   * 清除所有快取
   */
  async clear() {
    this.memoryCache.clear()
    await this.fileCache.clear()
  }

  /**
   * 清除特定類型的快取
   * @param {string} type - 快取類型
   */
  async clearByType(type) {
    // 記憶體快取需要遍歷
    for (const key of this.memoryCache.cache.keys()) {
      if (key.startsWith(`${type}:`)) {
        this.memoryCache.delete(key)
      }
    }

    // 檔案快取較難按類型清除，這裡只清理過期的
    if (USE_FILE_CACHE[type]) {
      await this.fileCache.cleanupExpired()
    }
  }

  /**
   * 從鍵推斷快取類型
   * @param {string} key - 快取鍵
   * @returns {string}
   * @private
   */
  _inferType(key) {
    for (const type of Object.values(CACHE_TYPES)) {
      if (key.startsWith(`${type}:`)) {
        return type
      }
    }
    return CACHE_TYPES.VIDEO // 預設
  }

  /**
   * 取得統計資訊
   * @returns {Object}
   */
  getStats() {
    const memoryStats = this.memoryCache.getStats()
    const fileStats = this.fileCache.getStats()

    return {
      manager: {
        ...this.stats,
        totalHits: this.stats.memoryHits + this.stats.fileHits,
        hitRate: this.stats.totalGets > 0
          ? ((this.stats.memoryHits + this.stats.fileHits) / this.stats.totalGets * 100).toFixed(2) + '%'
          : '0%'
      },
      memory: memoryStats,
      file: fileStats
    }
  }

  /**
   * 銷毀快取管理器
   */
  destroy() {
    this.memoryCache.destroy()
  }

  // ========== 便捷方法 ==========

  /**
   * 快取搜尋結果
   * @param {string} query - 搜尋關鍵字
   * @param {*} results - 搜尋結果
   */
  async cacheSearchResults(query, results) {
    const key = this._generateKey(CACHE_TYPES.SEARCH, query)
    await this.set(key, results, { type: CACHE_TYPES.SEARCH })
  }

  /**
   * 取得搜尋結果快取
   * @param {string} query - 搜尋關鍵字
   * @returns {Promise<*>}
   */
  async getSearchResults(query) {
    const key = this._generateKey(CACHE_TYPES.SEARCH, query)
    return await this.get(key, { type: CACHE_TYPES.SEARCH })
  }

  /**
   * 快取影片資訊
   * @param {string} videoId - 影片 ID
   * @param {*} info - 影片資訊
   */
  async cacheVideoInfo(videoId, info) {
    const key = this._generateKey(CACHE_TYPES.VIDEO, videoId)
    await this.set(key, info, { type: CACHE_TYPES.VIDEO })
  }

  /**
   * 取得影片資訊快取
   * @param {string} videoId - 影片 ID
   * @returns {Promise<*>}
   */
  async getVideoInfo(videoId) {
    const key = this._generateKey(CACHE_TYPES.VIDEO, videoId)
    return await this.get(key, { type: CACHE_TYPES.VIDEO })
  }

  /**
   * 快取頻道資訊
   * @param {string} channelId - 頻道 ID
   * @param {*} info - 頻道資訊
   */
  async cacheChannelInfo(channelId, info) {
    const key = this._generateKey(CACHE_TYPES.CHANNEL, channelId)
    await this.set(key, info, { type: CACHE_TYPES.CHANNEL })
  }

  /**
   * 取得頻道資訊快取
   * @param {string} channelId - 頻道 ID
   * @returns {Promise<*>}
   */
  async getChannelInfo(channelId) {
    const key = this._generateKey(CACHE_TYPES.CHANNEL, channelId)
    return await this.get(key, { type: CACHE_TYPES.CHANNEL })
  }

  /**
   * 快取歌詞
   * @param {string} videoId - 影片 ID
   * @param {*} lyrics - 歌詞資料
   */
  async cacheLyrics(videoId, lyrics) {
    const key = this._generateKey(CACHE_TYPES.LYRICS, videoId)
    await this.set(key, lyrics, { type: CACHE_TYPES.LYRICS })
  }

  /**
   * 取得歌詞快取
   * @param {string} videoId - 影片 ID
   * @returns {Promise<*>}
   */
  async getLyrics(videoId) {
    const key = this._generateKey(CACHE_TYPES.LYRICS, videoId)
    return await this.get(key, { type: CACHE_TYPES.LYRICS })
  }
}

// 匯出
module.exports = CacheManager
module.exports.MemoryCache = MemoryCache
module.exports.FileCache = FileCache
module.exports.CACHE_TYPES = CACHE_TYPES
module.exports.DEFAULT_TTL = DEFAULT_TTL
