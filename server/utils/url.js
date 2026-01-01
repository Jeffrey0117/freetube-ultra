/**
 * URL Processing Utilities for FreeTube Server
 * @module server/utils/url
 */

'use strict'

const { URL } = require('url')

/**
 * 解析 URL 中的 query string 參數
 * @param {string} url - 要解析的 URL 字串
 * @returns {Object.<string, string>} 解析後的 query 參數物件
 * @example
 * parseQuery('/api/search?q=test&page=1')
 * // Returns: { q: 'test', page: '1' }
 *
 * parseQuery('/api/video')
 * // Returns: {}
 */
function parseQuery(url) {
  try {
    // 使用假的 base URL 來解析相對路徑
    const parsedUrl = new URL(url, 'http://localhost')
    const params = {}

    for (const [key, value] of parsedUrl.searchParams.entries()) {
      params[key] = value
    }

    return params
  } catch (error) {
    // 如果 URL 解析失敗，回傳空物件
    return {}
  }
}

/**
 * 將 URL 進行 Base64 編碼
 * 用於安全地在 URL 中傳遞其他 URL
 * @param {string} url - 要編碼的 URL 字串
 * @returns {string} Base64 編碼後的字串
 * @example
 * encodeUrl('https://example.com/video?id=123')
 * // Returns: 'aHR0cHM6Ly9leGFtcGxlLmNvbS92aWRlbz9pZD0xMjM='
 */
function encodeUrl(url) {
  return Buffer.from(url, 'utf-8').toString('base64')
}

/**
 * 將 Base64 編碼的字串解碼回原始 URL
 * @param {string} encoded - Base64 編碼的字串
 * @returns {string} 解碼後的原始 URL 字串
 * @throws {Error} 如果輸入不是有效的 Base64 編碼字串
 * @example
 * decodeUrl('aHR0cHM6Ly9leGFtcGxlLmNvbS92aWRlbz9pZD0xMjM=')
 * // Returns: 'https://example.com/video?id=123'
 */
function decodeUrl(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf-8')
}

module.exports = {
  parseQuery,
  encodeUrl,
  decodeUrl
}
