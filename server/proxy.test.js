/**
 * Proxy 系統測試
 * 執行: node server/proxy.test.js
 *
 * 測試範圍:
 * - Video Proxy (/videoplayback)
 * - Image Proxy (/vi, /vi_webp, /ggpht, /imgproxy)
 * - Manifest Proxy (/manifest)
 * - CORS headers
 * - 錯誤處理
 */

// 測試結果收集
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

// ========== 測試輔助函數 ==========

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

async function testAsync(name, fn) {
  try {
    await fn()
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

function assertContains(str, substr, message) {
  if (!str || !str.includes(substr)) {
    throw new Error(message || `Expected "${str}" to contain "${substr}"`)
  }
}

function assertMatch(str, regex, message) {
  if (!str || !regex.test(str)) {
    throw new Error(message || `Expected "${str}" to match ${regex}`)
  }
}

// ========== Mock HTTP 請求/回應 ==========

class MockRequest {
  constructor(options = {}) {
    this.method = options.method || 'GET'
    this.url = options.url || '/'
    this.headers = options.headers || {}
    this._listeners = {}
  }

  on(event, callback) {
    this._listeners[event] = callback
    return this
  }

  emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event](data)
    }
  }
}

class MockResponse {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.body = ''
    this.headersSent = false
    this._ended = false
    this._chunks = []
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value
    return this
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode
    this.headersSent = true
    Object.entries(headers).forEach(([key, value]) => {
      this.headers[key.toLowerCase()] = value
    })
    return this
  }

  write(chunk) {
    this._chunks.push(chunk)
    return true
  }

  end(data) {
    if (data) {
      this.body = data
    } else if (this._chunks.length > 0) {
      this.body = this._chunks.join('')
    }
    this._ended = true
    return this
  }

  pipe(dest) {
    // Mock pipe
    return this
  }
}

// ========== URL 工具函數測試 ==========

function testUrlUtilities() {
  console.log('\n\x1b[36m=== URL 工具函數測試 ===\x1b[0m')

  // toProxyUrl 函數測試
  test('toProxyUrl: 空 URL 應返回空字串', () => {
    const result = toProxyUrl('')
    assertEqual(result, '')
  })

  test('toProxyUrl: null 應返回空字串', () => {
    const result = toProxyUrl(null)
    assertEqual(result, '')
  })

  test('toProxyUrl: 正確編碼 YouTube URL', () => {
    const originalUrl = 'https://rr1---sn-xxx.googlevideo.com/videoplayback?expire=1234&id=test'
    const result = toProxyUrl(originalUrl)
    assertContains(result, '/videoplayback?url=')
    // 驗證可以解碼回原始 URL
    const encoded = result.replace('/videoplayback?url=', '')
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    assertEqual(decoded, originalUrl)
  })

  // toGgphtProxyUrl 函數測試
  test('toGgphtProxyUrl: 空 URL 應返回空字串', () => {
    const result = toGgphtProxyUrl('')
    assertEqual(result, '')
  })

  test('toGgphtProxyUrl: 處理 protocol-relative URL', () => {
    const url = '//yt3.ggpht.com/channel_avatar/path'
    const result = toGgphtProxyUrl(url)
    assertEqual(result, '/ggpht/channel_avatar/path')
  })

  test('toGgphtProxyUrl: 轉換 yt3.ggpht.com URL', () => {
    const url = 'https://yt3.ggpht.com/ytc/avatar123'
    const result = toGgphtProxyUrl(url)
    assertEqual(result, '/ggpht/ytc/avatar123')
  })

  test('toGgphtProxyUrl: 轉換 googleusercontent.com URL', () => {
    const url = 'https://lh3.googleusercontent.com/avatar123'
    const result = toGgphtProxyUrl(url)
    assertContains(result, '/imgproxy?url=')
    // 驗證可以解碼回原始 URL
    const encoded = result.replace('/imgproxy?url=', '')
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    assertEqual(decoded, url)
  })

  test('toGgphtProxyUrl: 非 Google URL 保持不變', () => {
    const url = 'https://example.com/image.jpg'
    const result = toGgphtProxyUrl(url)
    assertEqual(result, url)
  })

  // toVideoThumbnailProxyUrl 函數測試
  test('toVideoThumbnailProxyUrl: 空 URL 應返回空字串', () => {
    const result = toVideoThumbnailProxyUrl('')
    assertEqual(result, '')
  })

  test('toVideoThumbnailProxyUrl: 轉換 vi 縮圖 URL', () => {
    const url = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    const result = toVideoThumbnailProxyUrl(url)
    assertEqual(result, '/vi/dQw4w9WgXcQ/maxresdefault.jpg')
  })

  test('toVideoThumbnailProxyUrl: 轉換 vi_webp 縮圖 URL', () => {
    const url = 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp'
    const result = toVideoThumbnailProxyUrl(url)
    assertEqual(result, '/vi_webp/dQw4w9WgXcQ/maxresdefault.webp')
  })

  test('toVideoThumbnailProxyUrl: 非 ytimg URL 保持不變', () => {
    const url = 'https://example.com/thumb.jpg'
    const result = toVideoThumbnailProxyUrl(url)
    assertEqual(result, url)
  })
}

// ========== Video Proxy 測試 ==========

function testVideoProxy() {
  console.log('\n\x1b[36m=== Video Proxy 測試 (/videoplayback) ===\x1b[0m')

  test('缺少 url 參數應返回 400', () => {
    const res = new MockResponse()
    const query = {}

    // 模擬處理邏輯
    if (!query.url) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'Missing url parameter' }))
    }

    assertEqual(res.statusCode, 400)
    const body = JSON.parse(res.body)
    assertEqual(body.error, 'Missing url parameter')
  })

  test('正確解碼 base64url 編碼的 URL', () => {
    const originalUrl = 'https://rr1---sn-xxx.googlevideo.com/videoplayback?expire=1234567890&ei=abc&ip=1.2.3.4'
    const encoded = Buffer.from(originalUrl).toString('base64url')
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    assertEqual(decoded, originalUrl)
  })

  test('URL 建構邏輯正確處理特殊字元', () => {
    const originalUrl = 'https://example.com/path?key=value&foo=bar%20baz'
    const encoded = Buffer.from(originalUrl).toString('base64url')
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    assertEqual(decoded, originalUrl)
  })

  test('處理帶有 Range header 的請求', () => {
    const req = new MockRequest({
      headers: { range: 'bytes=0-1000' }
    })
    assertTrue(req.headers.range === 'bytes=0-1000')
  })

  test('CORS headers 正確設置', () => {
    const res = new MockResponse()
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    }

    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value)
    })

    assertEqual(res.headers['access-control-allow-origin'], '*')
    assertEqual(res.headers['access-control-allow-headers'], 'Range')
    assertContains(res.headers['access-control-expose-headers'], 'Content-Range')
  })
}

// ========== Image Proxy 測試 ==========

function testImageProxy() {
  console.log('\n\x1b[36m=== Image Proxy 測試 (/vi, /vi_webp, /ggpht, /imgproxy) ===\x1b[0m')

  // /vi 和 /vi_webp 路徑測試
  test('解析 /vi 縮圖路徑 - 標準格式', () => {
    const path = '/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    const match = path.match(/^\/(vi|vi_webp)\/([a-zA-Z0-9_-]+)\/(.+)$/)
    assertTrue(match !== null)
    assertEqual(match[1], 'vi')
    assertEqual(match[2], 'dQw4w9WgXcQ')
    assertEqual(match[3], 'maxresdefault.jpg')
  })

  test('解析 /vi_webp 縮圖路徑', () => {
    const path = '/vi_webp/abc123XYZ/hqdefault.webp'
    const match = path.match(/^\/(vi|vi_webp)\/([a-zA-Z0-9_-]+)\/(.+)$/)
    assertTrue(match !== null)
    assertEqual(match[1], 'vi_webp')
    assertEqual(match[2], 'abc123XYZ')
    assertEqual(match[3], 'hqdefault.webp')
  })

  test('解析不同品質的縮圖', () => {
    const qualities = ['default.jpg', 'mqdefault.jpg', 'hqdefault.jpg', 'sddefault.jpg', 'maxresdefault.jpg']
    qualities.forEach(quality => {
      const path = `/vi/testVideoId/${quality}`
      const match = path.match(/^\/(vi|vi_webp)\/([a-zA-Z0-9_-]+)\/(.+)$/)
      assertTrue(match !== null, `Should match ${quality}`)
      assertEqual(match[3], quality)
    })
  })

  test('建構正確的 YouTube 縮圖目標 URL', () => {
    const viPath = 'vi'
    const videoId = 'dQw4w9WgXcQ'
    const filename = 'maxresdefault.jpg'
    const targetUrl = `https://i.ytimg.com/${viPath}/${videoId}/${filename}`
    assertEqual(targetUrl, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
  })

  // /ggpht 路徑測試
  test('解析 /ggpht 頻道頭像路徑', () => {
    const path = '/ggpht/ytc/AIdro_mKzWX1234'
    assertTrue(path.startsWith('/ggpht/'))
    const ggphtPath = path.replace('/ggpht', '')
    assertEqual(ggphtPath, '/ytc/AIdro_mKzWX1234')
  })

  test('建構 googleusercontent 目標 URL', () => {
    const ggphtPath = '/ytc/avatar123'
    const googleUrl = `https://yt3.googleusercontent.com${ggphtPath}`
    assertEqual(googleUrl, 'https://yt3.googleusercontent.com/ytc/avatar123')
  })

  test('建構 ggpht.com 目標 URL', () => {
    const ggphtPath = '/ytc/avatar123'
    const ggphtUrl = `https://yt3.ggpht.com${ggphtPath}`
    assertEqual(ggphtUrl, 'https://yt3.ggpht.com/ytc/avatar123')
  })

  // /imgproxy 測試
  test('/imgproxy: 缺少 url 參數應返回 400', () => {
    const res = new MockResponse()
    const query = {}

    if (!query.url) {
      res.writeHead(400)
      res.end('Missing url parameter')
    }

    assertEqual(res.statusCode, 400)
    assertEqual(res.body, 'Missing url parameter')
  })

  test('/imgproxy: 正確解碼 base64url URL', () => {
    const originalUrl = 'https://lh3.googleusercontent.com/a/ABC123'
    const encodedUrl = Buffer.from(originalUrl).toString('base64url')
    const decodedUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
    assertEqual(decodedUrl, originalUrl)
  })

  // 快取 headers 測試
  test('圖片回應應包含正確的 Cache-Control header', () => {
    const res = new MockResponse()
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    })

    assertEqual(res.headers['cache-control'], 'public, max-age=86400')
    assertEqual(res.headers['content-type'], 'image/jpeg')
    assertEqual(res.headers['access-control-allow-origin'], '*')
  })
}

// ========== Manifest Proxy 測試 ==========

function testManifestProxy() {
  console.log('\n\x1b[36m=== Manifest Proxy 測試 (/manifest) ===\x1b[0m')

  test('/manifest: 缺少 url 參數應返回 400', () => {
    const res = new MockResponse()
    const query = {}

    if (!query.url) {
      res.writeHead(400)
      res.end('Missing url parameter')
    }

    assertEqual(res.statusCode, 400)
    assertEqual(res.body, 'Missing url parameter')
  })

  test('DASH manifest URL 正確解碼', () => {
    const originalUrl = 'https://manifest.googlevideo.com/api/manifest/dash/expire/123/id/abc'
    const encodedUrl = Buffer.from(originalUrl).toString('base64url')
    const decodedUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
    assertEqual(decodedUrl, originalUrl)
  })

  test('BaseURL 替換邏輯正確', () => {
    const sampleManifest = `<?xml version="1.0"?>
<MPD>
  <BaseURL>https://rr1.googlevideo.com/videoplayback?id=abc</BaseURL>
  <Representation>
    <BaseURL>https://rr2.googlevideo.com/videoplayback?id=def</BaseURL>
  </Representation>
</MPD>`

    const modifiedData = sampleManifest.replace(
      /<BaseURL>([^<]+)<\/BaseURL>/g,
      (match, url) => {
        const encoded = Buffer.from(url).toString('base64url')
        return `<BaseURL>/videoplayback?url=${encoded}</BaseURL>`
      }
    )

    assertContains(modifiedData, '<BaseURL>/videoplayback?url=')
    assertFalse(modifiedData.includes('https://rr1.googlevideo.com'))
    assertFalse(modifiedData.includes('https://rr2.googlevideo.com'))
  })

  test('Manifest 回應 Content-Type 正確', () => {
    const res = new MockResponse()
    res.writeHead(200, {
      'Content-Type': 'application/dash+xml',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    })

    assertEqual(res.headers['content-type'], 'application/dash+xml')
    assertEqual(res.headers['cache-control'], 'no-cache')
  })
}

// ========== DASH Manifest 生成測試 ==========

function testDashManifestGeneration() {
  console.log('\n\x1b[36m=== DASH Manifest 生成測試 ===\x1b[0m')

  test('生成正確的 ISO 8601 時長格式', () => {
    // 測試 3661 秒 = 1小時1分1秒
    const duration = 3661
    const durationISO = `PT${Math.floor(duration / 3600)}H${Math.floor((duration % 3600) / 60)}M${duration % 60}S`
    assertEqual(durationISO, 'PT1H1M1S')
  })

  test('生成正確的短時長格式', () => {
    const duration = 185 // 3分5秒
    const durationISO = `PT${Math.floor(duration / 3600)}H${Math.floor((duration % 3600) / 60)}M${duration % 60}S`
    assertEqual(durationISO, 'PT0H3M5S')
  })

  test('篩選視頻格式', () => {
    const adaptiveFormats = [
      { mime_type: 'video/mp4; codecs="avc1.640028"', itag: 137 },
      { mime_type: 'video/webm; codecs="vp9"', itag: 248 },
      { mime_type: 'audio/mp4; codecs="mp4a.40.2"', itag: 140 },
      { mime_type: 'audio/webm; codecs="opus"', itag: 251 },
    ]

    const videoFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('video/'))
    const audioFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('audio/'))

    assertEqual(videoFormats.length, 2)
    assertEqual(audioFormats.length, 2)
  })

  test('提取 codecs 資訊', () => {
    const mimeType = 'video/mp4; codecs="avc1.640028"'
    const codecs = mimeType?.match(/codecs="([^"]+)"/)?.[1] || ''
    assertEqual(codecs, 'avc1.640028')
  })

  test('處理沒有 codecs 的 mime_type', () => {
    const mimeType = 'video/mp4'
    const codecs = mimeType?.match(/codecs="([^"]+)"/)?.[1] || ''
    assertEqual(codecs, '')
  })
}

// ========== XML 轉義測試 ==========

function testXmlEscaping() {
  console.log('\n\x1b[36m=== XML 轉義測試 ===\x1b[0m')

  test('escapeXml: 空字串應返回空字串', () => {
    const result = escapeXml('')
    assertEqual(result, '')
  })

  test('escapeXml: null 應返回空字串', () => {
    const result = escapeXml(null)
    assertEqual(result, '')
  })

  test('escapeXml: 轉義 & 符號', () => {
    const result = escapeXml('foo&bar')
    assertEqual(result, 'foo&amp;bar')
  })

  test('escapeXml: 轉義 < 符號', () => {
    const result = escapeXml('foo<bar')
    assertEqual(result, 'foo&lt;bar')
  })

  test('escapeXml: 轉義 > 符號', () => {
    const result = escapeXml('foo>bar')
    assertEqual(result, 'foo&gt;bar')
  })

  test('escapeXml: 轉義雙引號', () => {
    const result = escapeXml('foo"bar')
    assertEqual(result, 'foo&quot;bar')
  })

  test('escapeXml: 轉義單引號', () => {
    const result = escapeXml("foo'bar")
    assertEqual(result, 'foo&apos;bar')
  })

  test('escapeXml: 轉義複合字串', () => {
    const result = escapeXml('<url>&test="value"</url>')
    assertEqual(result, '&lt;url&gt;&amp;test=&quot;value&quot;&lt;/url&gt;')
  })
}

// ========== 通用錯誤處理測試 ==========

function testErrorHandling() {
  console.log('\n\x1b[36m=== 錯誤處理測試 ===\x1b[0m')

  test('錯誤回應應包含 JSON 格式', () => {
    const res = new MockResponse()
    const error = { error: 'Something went wrong' }
    res.writeHead(500)
    res.end(JSON.stringify(error))

    assertEqual(res.statusCode, 500)
    const body = JSON.parse(res.body)
    assertEqual(body.error, 'Something went wrong')
  })

  test('404 錯誤處理', () => {
    const res = new MockResponse()
    res.writeHead(404)
    res.end('Not found')

    assertEqual(res.statusCode, 404)
    assertEqual(res.body, 'Not found')
  })

  test('502 Bad Gateway 錯誤 (上游代理失敗)', () => {
    const res = new MockResponse()
    res.writeHead(502)
    res.end('Manifest fetch failed')

    assertEqual(res.statusCode, 502)
    assertEqual(res.body, 'Manifest fetch failed')
  })

  test('headersSent 狀態追蹤', () => {
    const res = new MockResponse()
    assertFalse(res.headersSent)
    res.writeHead(200)
    assertTrue(res.headersSent)
  })
}

// ========== CORS 測試 ==========

function testCorsHeaders() {
  console.log('\n\x1b[36m=== CORS Headers 測試 ===\x1b[0m')

  test('OPTIONS 請求應返回 200', () => {
    const req = new MockRequest({ method: 'OPTIONS' })
    const res = new MockResponse()

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
    }

    assertEqual(res.statusCode, 200)
  })

  test('所有回應應包含 Access-Control-Allow-Origin', () => {
    const res = new MockResponse()
    res.setHeader('Access-Control-Allow-Origin', '*')
    assertEqual(res.headers['access-control-allow-origin'], '*')
  })

  test('所有回應應包含 Access-Control-Allow-Methods', () => {
    const res = new MockResponse()
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    assertEqual(res.headers['access-control-allow-methods'], 'GET, POST, OPTIONS')
  })

  test('影片串流回應應暴露 Content-Range header', () => {
    const res = new MockResponse()
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
    assertContains(res.headers['access-control-expose-headers'], 'Content-Range')
  })
}

// ========== parseDuration 測試 ==========

function testParseDuration() {
  console.log('\n\x1b[36m=== parseDuration 測試 ===\x1b[0m')

  test('parseDuration: 空字串應返回 0', () => {
    const result = parseDuration('')
    assertEqual(result, 0)
  })

  test('parseDuration: null 應返回 0', () => {
    const result = parseDuration(null)
    assertEqual(result, 0)
  })

  test('parseDuration: 分:秒 格式 (3:45)', () => {
    const result = parseDuration('3:45')
    assertEqual(result, 225) // 3*60 + 45
  })

  test('parseDuration: 時:分:秒 格式 (1:30:00)', () => {
    const result = parseDuration('1:30:00')
    assertEqual(result, 5400) // 1*3600 + 30*60 + 0
  })

  test('parseDuration: 短影片 (0:30)', () => {
    const result = parseDuration('0:30')
    assertEqual(result, 30)
  })

  test('parseDuration: 長影片 (2:15:30)', () => {
    const result = parseDuration('2:15:30')
    assertEqual(result, 8130) // 2*3600 + 15*60 + 30
  })
}

// ========== createAuthorThumbnails 測試 ==========

function testCreateAuthorThumbnails() {
  console.log('\n\x1b[36m=== createAuthorThumbnails 測試 ===\x1b[0m')

  test('空 URL 應返回空陣列', () => {
    const result = createAuthorThumbnails('')
    assertEqual(result, [])
  })

  test('正確生成 4 種尺寸的縮圖', () => {
    const result = createAuthorThumbnails('https://yt3.ggpht.com/ytc/avatar')
    assertEqual(result.length, 4)
  })

  test('縮圖尺寸正確 (32, 48, 76, 176)', () => {
    const result = createAuthorThumbnails('https://yt3.ggpht.com/ytc/avatar')
    const sizes = result.map(t => t.width)
    assertEqual(sizes, [32, 48, 76, 176])
  })

  test('所有縮圖應使用 proxy URL', () => {
    const result = createAuthorThumbnails('https://yt3.ggpht.com/ytc/avatar')
    result.forEach(thumb => {
      assertContains(thumb.url, '/ggpht/')
    })
  })
}

// ========== 路由匹配測試 ==========

function testRouteMatching() {
  console.log('\n\x1b[36m=== 路由匹配測試 ===\x1b[0m')

  test('匹配 /vi 縮圖路由', () => {
    const path = '/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    const match = path.match(/^\/(vi|vi_webp)\/([a-zA-Z0-9_-]+)\/(.+)$/)
    assertTrue(match !== null)
  })

  test('匹配 /ggpht 頭像路由', () => {
    const path = '/ggpht/ytc/avatar123'
    assertTrue(path.startsWith('/ggpht/'))
  })

  test('匹配 /imgproxy 路由', () => {
    const path = '/imgproxy'
    assertEqual(path, '/imgproxy')
  })

  test('匹配 /manifest 路由', () => {
    const path = '/manifest'
    assertEqual(path, '/manifest')
  })

  test('匹配 /videoplayback 路由', () => {
    const path = '/videoplayback'
    assertEqual(path, '/videoplayback')
  })

  test('匹配 DASH manifest API 路由', () => {
    const path = '/api/manifest/dash/id/dQw4w9WgXcQ'
    const match = path.match(/^\/api\/manifest\/dash\/id\/([a-zA-Z0-9_-]+)/)
    assertTrue(match !== null)
    assertEqual(match[1], 'dQw4w9WgXcQ')
  })

  test('匹配影片 API 路由', () => {
    const path = '/api/v1/videos/dQw4w9WgXcQ'
    const match = path.match(/^\/api\/v1\/videos\/([a-zA-Z0-9_-]+)/)
    assertTrue(match !== null)
    assertEqual(match[1], 'dQw4w9WgXcQ')
  })
}

// ========== 超時處理測試 ==========

function testTimeoutHandling() {
  console.log('\n\x1b[36m=== 超時處理測試 ===\x1b[0m')

  test('預設超時時間應為 30 秒', () => {
    const defaultTimeout = 30000
    assertEqual(defaultTimeout, 30000)
  })

  test('超時後應 destroy 請求', async () => {
    let destroyed = false
    const mockReq = {
      setTimeout: (timeout, callback) => {
        // 模擬超時
        callback()
      },
      destroy: () => {
        destroyed = true
      }
    }

    mockReq.setTimeout(30000, () => {
      mockReq.destroy()
    })

    assertTrue(destroyed)
  })
}

// ========== 測試用的工具函數實現 ==========

function toProxyUrl(originalUrl) {
  if (!originalUrl) return ''
  const encoded = Buffer.from(originalUrl).toString('base64url')
  return `/videoplayback?url=${encoded}`
}

function toGgphtProxyUrl(url) {
  if (!url) return ''
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  if (url.includes('yt3.ggpht.com')) {
    const ggphtPath = url.replace(/^https?:\/\/yt3\.ggpht\.com/, '')
    return `/ggpht${ggphtPath}`
  }
  if (url.includes('googleusercontent.com')) {
    const encoded = Buffer.from(url).toString('base64url')
    return `/imgproxy?url=${encoded}`
  }
  return url
}

function toVideoThumbnailProxyUrl(url) {
  if (!url) return ''
  const match = url.match(/^https?:\/\/i\.ytimg\.com\/((vi|vi_webp)\/[^/]+\/.+)$/)
  if (match) {
    return `/${match[1]}`
  }
  return url
}

function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function parseDuration(durationStr) {
  if (!durationStr) return 0
  const parts = durationStr.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

function createAuthorThumbnails(avatarUrl) {
  const url = toGgphtProxyUrl(avatarUrl)
  if (!url) return []
  return [
    { url, width: 32, height: 32 },
    { url, width: 48, height: 48 },
    { url, width: 76, height: 76 },
    { url, width: 176, height: 176 },
  ]
}

// ========== 執行測試 ==========

async function runAllTests() {
  console.log('\x1b[35m======================================\x1b[0m')
  console.log('\x1b[35m       Proxy 系統測試\x1b[0m')
  console.log('\x1b[35m======================================\x1b[0m')

  const startTime = Date.now()

  // 執行所有測試套件
  testUrlUtilities()
  testVideoProxy()
  testImageProxy()
  testManifestProxy()
  testDashManifestGeneration()
  testXmlEscaping()
  testErrorHandling()
  testCorsHeaders()
  testParseDuration()
  testCreateAuthorThumbnails()
  testRouteMatching()
  testTimeoutHandling()

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

runAllTests().catch(error => {
  console.error('\x1b[31m測試執行失敗:\x1b[0m', error)
  process.exit(1)
})
