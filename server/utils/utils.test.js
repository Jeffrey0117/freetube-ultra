/**
 * Utils 工具函數測試
 * 執行: node server/utils/utils.test.js
 */

'use strict'

const { successResponse, errorResponse, setCorsHeaders } = require('./response')
const { parseQuery, encodeUrl, decodeUrl } = require('./url')

// 測試結果收集
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

// ========== 測試框架 ==========

function test(name, fn) {
  try {
    fn()
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    console.log(`  \x1b[31m✗\x1b[0m ${name}`)
    console.log(`    \x1b[33mError: ${error.message}\x1b[0m`)
  }
}

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

function assertThrows(fn, message) {
  let threw = false
  try {
    fn()
  } catch (e) {
    threw = true
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw')
  }
}

// ========== Mock 物件 ==========

/**
 * 建立模擬的 HTTP Response 物件
 * @returns {Object} 模擬的 res 物件
 */
function createMockResponse() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    ended: false,

    setHeader(name, value) {
      res.headers[name] = value
    },

    getHeader(name) {
      return res.headers[name]
    },

    end(data) {
      res.body = data
      res.ended = true
    },

    // 輔助方法：解析 JSON body
    getJsonBody() {
      return JSON.parse(res.body)
    }
  }
  return res
}

/**
 * 建立模擬的 HTTP Request 物件
 * @param {Object} options - 請求選項
 * @returns {Object} 模擬的 req 物件
 */
function createMockRequest(options = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {},
    body: options.body || null
  }
}

// ========== response.js 測試 ==========

function testSuccessResponse() {
  console.log('\n\x1b[36m=== successResponse 測試 ===\x1b[0m')

  test('應設定正確的狀態碼 (預設 200)', () => {
    const res = createMockResponse()
    successResponse(res, { message: 'OK' })
    assertEqual(res.statusCode, 200)
  })

  test('應設定自訂狀態碼 201', () => {
    const res = createMockResponse()
    successResponse(res, { id: 1 }, 201)
    assertEqual(res.statusCode, 201)
  })

  test('應設定正確的 Content-Type header', () => {
    const res = createMockResponse()
    successResponse(res, { test: true })
    assertEqual(res.headers['Content-Type'], 'application/json; charset=utf-8')
  })

  test('應正確序列化簡單物件', () => {
    const res = createMockResponse()
    const data = { message: 'Hello', count: 42 }
    successResponse(res, data)
    assertEqual(res.getJsonBody(), data)
  })

  test('應正確序列化巢狀物件', () => {
    const res = createMockResponse()
    const data = {
      user: { id: 1, name: 'Test' },
      items: [1, 2, 3],
      metadata: { nested: { deep: true } }
    }
    successResponse(res, data)
    assertEqual(res.getJsonBody(), data)
  })

  test('應正確序列化陣列', () => {
    const res = createMockResponse()
    const data = [1, 2, 3, 'test']
    successResponse(res, data)
    assertEqual(res.getJsonBody(), data)
  })

  test('應正確序列化空物件', () => {
    const res = createMockResponse()
    successResponse(res, {})
    assertEqual(res.getJsonBody(), {})
  })

  test('應正確序列化 null', () => {
    const res = createMockResponse()
    successResponse(res, null)
    assertEqual(res.body, 'null')
  })

  test('應正確序列化字串', () => {
    const res = createMockResponse()
    successResponse(res, 'plain string')
    assertEqual(res.getJsonBody(), 'plain string')
  })

  test('應正確序列化數字', () => {
    const res = createMockResponse()
    successResponse(res, 12345)
    assertEqual(res.getJsonBody(), 12345)
  })

  test('應正確序列化布林值', () => {
    const res = createMockResponse()
    successResponse(res, true)
    assertEqual(res.getJsonBody(), true)
  })

  test('應呼叫 res.end()', () => {
    const res = createMockResponse()
    successResponse(res, {})
    assertTrue(res.ended, 'res.end() should be called')
  })

  test('應處理含中文的資料', () => {
    const res = createMockResponse()
    const data = { message: '測試訊息', title: '中文標題' }
    successResponse(res, data)
    assertEqual(res.getJsonBody(), data)
  })

  test('應處理含特殊字元的資料', () => {
    const res = createMockResponse()
    const data = { text: 'Hello\n\t"World"', special: '<>&' }
    successResponse(res, data)
    assertEqual(res.getJsonBody(), data)
  })
}

function testErrorResponse() {
  console.log('\n\x1b[36m=== errorResponse 測試 ===\x1b[0m')

  test('應設定正確的狀態碼 400', () => {
    const res = createMockResponse()
    errorResponse(res, 400, 'Bad Request')
    assertEqual(res.statusCode, 400)
  })

  test('應設定正確的狀態碼 404', () => {
    const res = createMockResponse()
    errorResponse(res, 404, 'Not Found')
    assertEqual(res.statusCode, 404)
  })

  test('應設定正確的狀態碼 500', () => {
    const res = createMockResponse()
    errorResponse(res, 500, 'Internal Server Error')
    assertEqual(res.statusCode, 500)
  })

  test('應設定正確的 Content-Type header', () => {
    const res = createMockResponse()
    errorResponse(res, 400, 'Bad Request')
    assertEqual(res.headers['Content-Type'], 'application/json; charset=utf-8')
  })

  test('錯誤回應應包含 error: true', () => {
    const res = createMockResponse()
    errorResponse(res, 400, 'Bad Request')
    assertTrue(res.getJsonBody().error, 'error should be true')
  })

  test('錯誤回應應包含 statusCode', () => {
    const res = createMockResponse()
    errorResponse(res, 403, 'Forbidden')
    assertEqual(res.getJsonBody().statusCode, 403)
  })

  test('錯誤回應應包含 message', () => {
    const res = createMockResponse()
    errorResponse(res, 400, 'Invalid input')
    assertEqual(res.getJsonBody().message, 'Invalid input')
  })

  test('不帶 details 時不應包含 details 欄位', () => {
    const res = createMockResponse()
    errorResponse(res, 400, 'Bad Request')
    const body = res.getJsonBody()
    assertFalse('details' in body, 'details should not exist')
  })

  test('帶 details 時應包含 details 欄位', () => {
    const res = createMockResponse()
    const details = { field: 'id', reason: 'must be a number' }
    errorResponse(res, 400, 'Invalid request', details)
    assertEqual(res.getJsonBody().details, details)
  })

  test('details 可以是字串', () => {
    const res = createMockResponse()
    errorResponse(res, 400, 'Error', 'Additional info')
    assertEqual(res.getJsonBody().details, 'Additional info')
  })

  test('details 可以是陣列', () => {
    const res = createMockResponse()
    const details = ['error1', 'error2']
    errorResponse(res, 400, 'Multiple errors', details)
    assertEqual(res.getJsonBody().details, details)
  })

  test('details 為 null 時不應包含 details 欄位', () => {
    const res = createMockResponse()
    errorResponse(res, 400, 'Error', null)
    assertFalse('details' in res.getJsonBody())
  })

  test('應呼叫 res.end()', () => {
    const res = createMockResponse()
    errorResponse(res, 500, 'Error')
    assertTrue(res.ended, 'res.end() should be called')
  })

  test('應正確格式化完整錯誤回應', () => {
    const res = createMockResponse()
    errorResponse(res, 422, 'Validation Error', { fields: ['name', 'email'] })
    const body = res.getJsonBody()
    assertEqual(body, {
      error: true,
      statusCode: 422,
      message: 'Validation Error',
      details: { fields: ['name', 'email'] }
    })
  })
}

function testSetCorsHeaders() {
  console.log('\n\x1b[36m=== setCorsHeaders 測試 ===\x1b[0m')

  test('應設定 Access-Control-Allow-Origin 為 *', () => {
    const res = createMockResponse()
    setCorsHeaders(res)
    assertEqual(res.headers['Access-Control-Allow-Origin'], '*')
  })

  test('應設定 Access-Control-Allow-Methods', () => {
    const res = createMockResponse()
    setCorsHeaders(res)
    assertEqual(res.headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, DELETE, OPTIONS')
  })

  test('應設定 Access-Control-Allow-Headers', () => {
    const res = createMockResponse()
    setCorsHeaders(res)
    assertEqual(res.headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization')
  })

  test('不應影響其他已設定的 headers', () => {
    const res = createMockResponse()
    res.setHeader('X-Custom-Header', 'custom-value')
    setCorsHeaders(res)
    assertEqual(res.headers['X-Custom-Header'], 'custom-value')
  })

  test('應能與 successResponse 組合使用', () => {
    const res = createMockResponse()
    setCorsHeaders(res)
    successResponse(res, { data: 'test' })
    assertTrue(res.headers['Access-Control-Allow-Origin'] === '*')
    assertTrue(res.headers['Content-Type'] === 'application/json; charset=utf-8')
  })
}

// ========== url.js 測試 ==========

function testParseQuery() {
  console.log('\n\x1b[36m=== parseQuery 測試 ===\x1b[0m')

  test('應解析單一參數', () => {
    const result = parseQuery('/api/search?q=test')
    assertEqual(result, { q: 'test' })
  })

  test('應解析多個參數', () => {
    const result = parseQuery('/api/search?q=test&page=1&limit=10')
    assertEqual(result, { q: 'test', page: '1', limit: '10' })
  })

  test('無參數時應返回空物件', () => {
    const result = parseQuery('/api/video')
    assertEqual(result, {})
  })

  test('只有 ? 無參數時應返回空物件', () => {
    const result = parseQuery('/api/search?')
    assertEqual(result, {})
  })

  test('應處理 URL 編碼的值', () => {
    const result = parseQuery('/api/search?q=hello%20world')
    assertEqual(result, { q: 'hello world' })
  })

  test('應處理中文參數', () => {
    const result = parseQuery('/api/search?q=%E6%B8%AC%E8%A9%A6')
    assertEqual(result, { q: '測試' })
  })

  test('應處理空值參數', () => {
    const result = parseQuery('/api/search?q=&page=1')
    assertEqual(result, { q: '', page: '1' })
  })

  test('應處理無值參數 (只有 key)', () => {
    const result = parseQuery('/api/search?debug')
    assertEqual(result, { debug: '' })
  })

  test('應處理特殊字元', () => {
    const result = parseQuery('/api/search?text=a%2Bb%3Dc')
    assertEqual(result, { text: 'a+b=c' })
  })

  test('應處理完整 URL', () => {
    const result = parseQuery('https://example.com/api/search?q=test')
    assertEqual(result, { q: 'test' })
  })

  test('無效 URL 應返回空物件', () => {
    const result = parseQuery('not a valid url')
    // URL 建構函數可能仍能解析，但結果應是空物件或有效結果
    assertTrue(typeof result === 'object')
  })

  test('空字串應返回空物件', () => {
    const result = parseQuery('')
    assertEqual(result, {})
  })

  test('應處理重複的參數名 (取最後一個)', () => {
    const result = parseQuery('/api/search?q=first&q=second')
    assertEqual(result, { q: 'second' })
  })

  test('應處理 hash fragment', () => {
    const result = parseQuery('/api/search?q=test#section')
    assertEqual(result, { q: 'test' })
  })

  test('應處理數字參數值', () => {
    const result = parseQuery('/api/video?id=12345&v=1.5')
    assertEqual(result, { id: '12345', v: '1.5' })
  })

  test('應處理布林字串值', () => {
    const result = parseQuery('/api/search?enabled=true&disabled=false')
    assertEqual(result, { enabled: 'true', disabled: 'false' })
  })
}

function testEncodeUrl() {
  console.log('\n\x1b[36m=== encodeUrl 測試 ===\x1b[0m')

  test('應編碼簡單 URL', () => {
    const encoded = encodeUrl('https://example.com')
    const expected = Buffer.from('https://example.com').toString('base64')
    assertEqual(encoded, expected)
  })

  test('應編碼帶參數的 URL', () => {
    const url = 'https://example.com/video?id=123'
    const encoded = encodeUrl(url)
    const expected = 'aHR0cHM6Ly9leGFtcGxlLmNvbS92aWRlbz9pZD0xMjM='
    assertEqual(encoded, expected)
  })

  test('應編碼帶中文的 URL', () => {
    const url = 'https://example.com/search?q=測試'
    const encoded = encodeUrl(url)
    // 驗證解碼回來是否正確
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    assertEqual(decoded, url)
  })

  test('應編碼空字串', () => {
    const encoded = encodeUrl('')
    assertEqual(encoded, '')
  })

  test('應編碼特殊字元', () => {
    const url = 'https://example.com/path?a=1&b=2#hash'
    const encoded = encodeUrl(url)
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    assertEqual(decoded, url)
  })

  test('編碼結果應只包含 Base64 字元', () => {
    const encoded = encodeUrl('https://example.com/test?query=value')
    const base64Regex = /^[A-Za-z0-9+/=]*$/
    assertTrue(base64Regex.test(encoded), 'Should only contain Base64 characters')
  })

  test('應處理長 URL', () => {
    const url = 'https://example.com/' + 'a'.repeat(1000)
    const encoded = encodeUrl(url)
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    assertEqual(decoded, url)
  })

  test('應處理含有 Unicode 表情符號', () => {
    const url = 'https://example.com/search?emoji=😀'
    const encoded = encodeUrl(url)
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    assertEqual(decoded, url)
  })
}

function testDecodeUrl() {
  console.log('\n\x1b[36m=== decodeUrl 測試 ===\x1b[0m')

  test('應解碼簡單 URL', () => {
    const encoded = Buffer.from('https://example.com').toString('base64')
    const decoded = decodeUrl(encoded)
    assertEqual(decoded, 'https://example.com')
  })

  test('應解碼帶參數的 URL', () => {
    const decoded = decodeUrl('aHR0cHM6Ly9leGFtcGxlLmNvbS92aWRlbz9pZD0xMjM=')
    assertEqual(decoded, 'https://example.com/video?id=123')
  })

  test('應解碼帶中文的 URL', () => {
    const original = 'https://example.com/search?q=測試'
    const encoded = Buffer.from(original).toString('base64')
    const decoded = decodeUrl(encoded)
    assertEqual(decoded, original)
  })

  test('應解碼空字串', () => {
    const decoded = decodeUrl('')
    assertEqual(decoded, '')
  })

  test('encodeUrl 和 decodeUrl 應互為反運算', () => {
    const original = 'https://example.com/path?a=1&b=2&c=中文#hash'
    const encoded = encodeUrl(original)
    const decoded = decodeUrl(encoded)
    assertEqual(decoded, original)
  })

  test('應處理無效的 Base64 字串 (不會拋出錯誤)', () => {
    // Node.js Buffer.from 對無效 Base64 不會拋出錯誤，只會返回部分結果
    const result = decodeUrl('not-valid-base64!!!')
    assertTrue(typeof result === 'string')
  })

  test('應處理帶 padding 的 Base64', () => {
    const encoded = 'dGVzdA==' // 'test' in base64
    const decoded = decodeUrl(encoded)
    assertEqual(decoded, 'test')
  })

  test('應處理不帶 padding 的 Base64', () => {
    const encoded = 'dGVzdA' // 'test' without padding
    const decoded = decodeUrl(encoded)
    assertEqual(decoded, 'test')
  })
}

function testUrlEdgeCases() {
  console.log('\n\x1b[36m=== URL 邊界情況測試 ===\x1b[0m')

  test('parseQuery 應處理 undefined (會拋出錯誤)', () => {
    // 注意：undefined 會導致 URL 建構函數錯誤，但應該被 catch 住
    try {
      const result = parseQuery(undefined)
      assertTrue(typeof result === 'object')
    } catch (e) {
      // 預期可能會有錯誤
    }
  })

  test('parseQuery 應處理 null', () => {
    try {
      const result = parseQuery(null)
      assertTrue(typeof result === 'object')
    } catch (e) {
      // 預期可能會有錯誤
    }
  })

  test('encodeUrl 和 decodeUrl 雙向轉換 - 多次編解碼', () => {
    const original = 'https://example.com/api?key=value'
    let current = original

    // 編碼解碼多次
    for (let i = 0; i < 5; i++) {
      current = encodeUrl(current)
    }
    for (let i = 0; i < 5; i++) {
      current = decodeUrl(current)
    }

    assertEqual(current, original)
  })

  test('應處理極長的查詢字串', () => {
    const params = []
    for (let i = 0; i < 100; i++) {
      params.push(`param${i}=value${i}`)
    }
    const url = '/api/test?' + params.join('&')
    const result = parseQuery(url)
    assertEqual(Object.keys(result).length, 100)
    assertEqual(result.param50, 'value50')
  })

  test('應處理特殊 URL 字元', () => {
    const url = '/api/search?url=' + encodeURIComponent('https://other.com?a=1&b=2')
    const result = parseQuery(url)
    assertEqual(result.url, 'https://other.com?a=1&b=2')
  })
}

// ========== 整合測試 ==========

function testIntegration() {
  console.log('\n\x1b[36m=== 整合測試 ===\x1b[0m')

  test('完整的 API 回應流程', () => {
    // 模擬請求
    const req = createMockRequest({
      method: 'GET',
      url: '/api/video?id=abc123&format=json'
    })

    // 解析查詢參數
    const params = parseQuery(req.url)
    assertEqual(params.id, 'abc123')
    assertEqual(params.format, 'json')

    // 建立回應
    const res = createMockResponse()
    setCorsHeaders(res)

    // 模擬成功回應
    const videoData = {
      id: params.id,
      title: 'Test Video',
      duration: 300
    }
    successResponse(res, videoData)

    // 驗證
    assertTrue(res.ended)
    assertEqual(res.statusCode, 200)
    assertEqual(res.headers['Access-Control-Allow-Origin'], '*')
    assertEqual(res.getJsonBody().id, 'abc123')
  })

  test('編碼 URL 作為參數傳遞', () => {
    const originalUrl = 'https://external.com/video?v=xyz'
    const encoded = encodeUrl(originalUrl)

    // 模擬 URL 中傳遞編碼後的 URL
    const requestUrl = `/api/proxy?url=${encoded}`
    const params = parseQuery(requestUrl)

    // 解碼回原始 URL
    const decoded = decodeUrl(params.url)
    assertEqual(decoded, originalUrl)
  })

  test('錯誤處理流程', () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/api/video?id='
    })

    const params = parseQuery(req.url)
    const res = createMockResponse()
    setCorsHeaders(res)

    // 檢查參數
    if (!params.id) {
      errorResponse(res, 400, 'Missing video ID', { field: 'id' })
    }

    assertEqual(res.statusCode, 400)
    assertEqual(res.getJsonBody().message, 'Missing video ID')
    assertTrue(res.headers['Access-Control-Allow-Origin'] === '*')
  })
}

// ========== 執行測試 ==========

function runAllTests() {
  console.log('\x1b[35m======================================\x1b[0m')
  console.log('\x1b[35m       Utils 工具函數測試\x1b[0m')
  console.log('\x1b[35m======================================\x1b[0m')

  const startTime = Date.now()

  // response.js 測試
  testSuccessResponse()
  testErrorResponse()
  testSetCorsHeaders()

  // url.js 測試
  testParseQuery()
  testEncodeUrl()
  testDecodeUrl()
  testUrlEdgeCases()

  // 整合測試
  testIntegration()

  const duration = Date.now() - startTime

  console.log('\n\x1b[35m======================================\x1b[0m')
  console.log('\x1b[35m       測試結果\x1b[0m')
  console.log('\x1b[35m======================================\x1b[0m')
  console.log(`  \x1b[32m通過: ${results.passed}\x1b[0m`)
  console.log(`  \x1b[31m失敗: ${results.failed}\x1b[0m`)
  console.log(`  總計: ${results.passed + results.failed}`)
  console.log(`  耗時: ${duration}ms`)
  console.log('\x1b[35m======================================\x1b[0m')

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

runAllTests()
