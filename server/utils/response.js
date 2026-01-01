/**
 * HTTP Response Utilities for FreeTube Server
 * @module server/utils/response
 */

'use strict'

/**
 * 發送成功回應
 * @param {import('http').ServerResponse} res - HTTP 回應物件
 * @param {any} data - 要回傳的資料
 * @param {number} [statusCode=200] - HTTP 狀態碼
 * @returns {void}
 * @example
 * successResponse(res, { message: 'OK' })
 * successResponse(res, { id: 1 }, 201)
 */
function successResponse(res, data, statusCode = 200) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

/**
 * 發送錯誤回應
 * @param {import('http').ServerResponse} res - HTTP 回應物件
 * @param {number} statusCode - HTTP 錯誤狀態碼
 * @param {string} message - 錯誤訊息
 * @param {any} [details=null] - 額外的錯誤細節資訊
 * @returns {void}
 * @example
 * errorResponse(res, 404, 'Not Found')
 * errorResponse(res, 400, 'Invalid request', { field: 'id', reason: 'must be a number' })
 */
function errorResponse(res, statusCode, message, details = null) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  const errorBody = {
    error: true,
    statusCode,
    message
  }

  if (details !== null) {
    errorBody.details = details
  }

  res.end(JSON.stringify(errorBody))
}

/**
 * 設定 CORS (Cross-Origin Resource Sharing) headers
 * 允許跨網域請求存取 API
 * @param {import('http').ServerResponse} res - HTTP 回應物件
 * @returns {void}
 * @example
 * setCorsHeaders(res)
 * // Sets headers:
 * // Access-Control-Allow-Origin: *
 * // Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
 * // Access-Control-Allow-Headers: Content-Type, Authorization
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

module.exports = {
  successResponse,
  errorResponse,
  setCorsHeaders
}
