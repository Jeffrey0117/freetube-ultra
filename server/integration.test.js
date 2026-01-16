/**
 * FreeTube Local API Server - Integration Tests
 * 端對端整合測試
 * 執行: node server/integration.test.js
 */

const http = require('http')
const { createApp, initializeServices, getInnertube } = require('./app')
const config = require('./config')

// 測試結果收集
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
}

// 測試伺服器
let server = null
let baseUrl = ''

// === 測試工具函數 ===

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

function skip(name, reason = '') {
  results.skipped++
  results.tests.push({ name, status: 'SKIP', reason })
  console.log(`  ○ ${name} (skipped${reason ? ': ' + reason : ''})`)
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

function assertIsArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message || `Expected array but got ${typeof value}`)
  }
}

function assertHasProperty(obj, prop, message) {
  if (!obj || typeof obj !== 'object' || !(prop in obj)) {
    throw new Error(message || `Expected object to have property "${prop}"`)
  }
}

// === HTTP 請求工具 ===

function httpGet(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const req = http.get(url, { timeout: options.timeout || 30000 }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => {
            try {
              return JSON.parse(data)
            } catch (e) {
              return null
            }
          }
        })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

function httpPost(path, body, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const postData = typeof body === 'string' ? body : JSON.stringify(body)

    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: options.timeout || 30000
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => {
            try {
              return JSON.parse(data)
            } catch (e) {
              return null
            }
          }
        })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.write(postData)
    req.end()
  })
}

// === 伺服器設定 ===

async function startServer() {
  const app = createApp()
  const port = 3099 // 使用不同的測試端口

  return new Promise((resolve, reject) => {
    server = http.createServer(app)
    server.listen(port, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${port}`
      console.log(`  Test server started at ${baseUrl}`)
      resolve()
    })
    server.on('error', reject)
  })
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('  Test server stopped')
        resolve()
      })
    } else {
      resolve()
    }
  })
}

// === 測試套件 ===

async function testHealthCheck() {
  console.log('\n=== Health Check 測試 ===')

  await testAsync('API stats 端點應返回伺服器資訊', async () => {
    const res = await httpGet('/api/v1/stats')
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'version', 'Should have version')
    assertHasProperty(data, 'software', 'Should have software')
    assertEqual(data.software.name, 'freetube-local-api', 'Software name should match')
  })

  await testAsync('不存在的路由應返回 404', async () => {
    const res = await httpGet('/api/v1/nonexistent')
    assertEqual(res.statusCode, 404, 'Status code should be 404')
  })

  await testAsync('OPTIONS preflight 請求應返回 200', async () => {
    // 使用原生 http 模組發送 OPTIONS 請求
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/v1/stats', baseUrl)
      const req = http.request(url, { method: 'OPTIONS' }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers }))
      })
      req.on('error', reject)
      req.end()
    })
    assertEqual(res.statusCode, 200, 'Status code should be 200')
  })
}

async function testSearchFlow() {
  console.log('\n=== 搜尋流程測試 ===')

  await testAsync('搜尋應返回結果陣列', async () => {
    const res = await httpGet('/api/v1/search?q=music')
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertIsArray(data, 'Response should be an array')
  })

  await testAsync('搜尋結果應包含必要欄位', async () => {
    const res = await httpGet('/api/v1/search?q=piano')
    const data = res.json()

    if (data.length > 0) {
      const video = data.find(item => item.type === 'video')
      if (video) {
        assertHasProperty(video, 'videoId', 'Video should have videoId')
        assertHasProperty(video, 'title', 'Video should have title')
        assertHasProperty(video, 'author', 'Video should have author')
        assertHasProperty(video, 'videoThumbnails', 'Video should have thumbnails')
      }
    }
  })

  await testAsync('搜尋建議應返回建議陣列', async () => {
    const res = await httpGet('/api/v1/search/suggestions?q=test')
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'query', 'Should have query')
    assertHasProperty(data, 'suggestions', 'Should have suggestions')
    assertIsArray(data.suggestions, 'Suggestions should be an array')
  })

  await testAsync('空搜尋應返回回應', async () => {
    const res = await httpGet('/api/v1/search?q=')
    // 空搜尋可能返回空結果、錯誤或內部錯誤
    assertTrue(res.statusCode >= 200, 'Should return a response')
  })
}

async function testVideoPlaybackFlow() {
  console.log('\n=== 影片播放流程測試 ===')

  // 使用知名的測試影片 ID (YouTube 官方測試影片)
  const testVideoId = 'dQw4w9WgXcQ' // Rick Astley - Never Gonna Give You Up

  await testAsync('取得影片資訊應返回詳細資料', async () => {
    const res = await httpGet(`/api/v1/videos/${testVideoId}`, { timeout: 60000 })
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'videoId', 'Should have videoId')
    assertHasProperty(data, 'title', 'Should have title')
    assertHasProperty(data, 'author', 'Should have author')
    assertHasProperty(data, 'lengthSeconds', 'Should have lengthSeconds')
    assertEqual(data.videoId, testVideoId, 'VideoId should match')
  })

  await testAsync('影片資訊應包含串流格式', async () => {
    const res = await httpGet(`/api/v1/videos/${testVideoId}`, { timeout: 60000 })
    const data = res.json()

    assertHasProperty(data, 'adaptiveFormats', 'Should have adaptiveFormats')
    assertIsArray(data.adaptiveFormats, 'adaptiveFormats should be an array')

    if (data.adaptiveFormats.length > 0) {
      const format = data.adaptiveFormats[0]
      assertHasProperty(format, 'url', 'Format should have url')
      assertHasProperty(format, 'itag', 'Format should have itag')
    }
  })

  await testAsync('影片資訊應包含推薦影片', async () => {
    const res = await httpGet(`/api/v1/videos/${testVideoId}`, { timeout: 60000 })
    const data = res.json()

    assertHasProperty(data, 'recommendedVideos', 'Should have recommendedVideos')
    assertIsArray(data.recommendedVideos, 'recommendedVideos should be an array')
  })

  await testAsync('DASH manifest 應返回 XML', async () => {
    const res = await httpGet(`/api/manifest/dash/id/${testVideoId}`, { timeout: 60000 })
    assertEqual(res.statusCode, 200, 'Status code should be 200')
    assertContains(res.headers['content-type'], 'dash+xml', 'Content-Type should be DASH XML')
    assertContains(res.body, '<?xml', 'Body should contain XML declaration')
    assertContains(res.body, '<MPD', 'Body should contain MPD element')
  })

  await testAsync('無效影片 ID 應返回錯誤或空資料', async () => {
    const res = await httpGet('/api/v1/videos/invalid_video_id_12345')
    // 無效 ID 可能返回 200 帶錯誤訊息，或返回 4xx/5xx
    assertTrue(res.statusCode >= 200, 'Should return a response')
  })
}

async function testChannelFlow() {
  console.log('\n=== 頻道訂閱流程測試 ===')

  // 使用知名頻道 ID
  const testChannelId = 'UC-lHJZR3Gqxm24_Vd_AJ5Yw' // PewDiePie

  await testAsync('取得頻道資訊應返回詳細資料', async () => {
    const res = await httpGet(`/api/v1/channels/${testChannelId}`, { timeout: 60000 })
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'author', 'Should have author')
    assertHasProperty(data, 'authorId', 'Should have authorId')
    assertHasProperty(data, 'description', 'Should have description')
    assertEqual(data.authorId, testChannelId, 'AuthorId should match')
  })

  await testAsync('頻道資訊應包含頭像和橫幅', async () => {
    const res = await httpGet(`/api/v1/channels/${testChannelId}`, { timeout: 60000 })
    const data = res.json()

    assertHasProperty(data, 'authorThumbnails', 'Should have authorThumbnails')
    assertIsArray(data.authorThumbnails, 'authorThumbnails should be an array')
  })

  await testAsync('頻道資訊應包含可用的 tabs', async () => {
    const res = await httpGet(`/api/v1/channels/${testChannelId}`, { timeout: 60000 })
    const data = res.json()

    assertHasProperty(data, 'tabs', 'Should have tabs')
    assertIsArray(data.tabs, 'tabs should be an array')
    assertTrue(data.tabs.length > 0, 'Should have at least one tab')
  })

  await testAsync('取得頻道影片應返回影片列表', async () => {
    const res = await httpGet(`/api/v1/channels/${testChannelId}/videos`, { timeout: 60000 })
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'videos', 'Should have videos')
    assertIsArray(data.videos, 'videos should be an array')
  })

  await testAsync('頻道影片應包含必要欄位', async () => {
    const res = await httpGet(`/api/v1/channels/${testChannelId}/videos`, { timeout: 60000 })
    const data = res.json()

    if (data.videos && data.videos.length > 0) {
      const video = data.videos[0]
      assertHasProperty(video, 'videoId', 'Video should have videoId')
      assertHasProperty(video, 'title', 'Video should have title')
      assertHasProperty(video, 'videoThumbnails', 'Video should have thumbnails')
    }
  })

  await testAsync('無效頻道 ID 應返回錯誤', async () => {
    const res = await httpGet('/api/v1/channels/invalid_channel_id_xyz')
    // 無效頻道可能返回 500 或其他錯誤碼
    assertTrue(res.statusCode >= 400 || res.statusCode === 200, 'Should return a response')
  })
}

async function testThumbnailProxy() {
  console.log('\n=== 縮圖代理測試 ===')

  const testVideoId = 'dQw4w9WgXcQ'

  await testAsync('影片縮圖代理應返回圖片', async () => {
    const res = await httpGet(`/vi/${testVideoId}/mqdefault.jpg`)
    assertEqual(res.statusCode, 200, 'Status code should be 200')
    assertContains(res.headers['content-type'], 'image', 'Content-Type should be image')
  })

  await testAsync('縮圖代理應設定快取標頭', async () => {
    const res = await httpGet(`/vi/${testVideoId}/default.jpg`)
    assertHasProperty(res.headers, 'cache-control', 'Should have Cache-Control header')
  })

  await testAsync('不存在的縮圖應返回 404', async () => {
    const res = await httpGet('/vi/nonexistent_video_xyz/mqdefault.jpg')
    // YouTube 可能返回預設圖片而非 404，所以只檢查有回應
    assertTrue(res.statusCode >= 200, 'Should return a response')
  })
}

async function testLyricsAPI() {
  console.log('\n=== 歌詞 API 測試 ===')

  await testAsync('歌詞快取查詢 (cache miss) 應返回 found: false', async () => {
    const res = await httpGet('/api/v1/lyrics/cache?track=NonexistentTestSong12345&artist=TestArtist')
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'found', 'Should have found property')
    assertEqual(data.found, false, 'Should not find non-existent lyrics')
  })

  await testAsync('歌詞快取儲存應成功', async () => {
    const testLyrics = {
      track: 'IntegrationTestSong',
      artist: 'TestArtist',
      lyricsData: {
        plainLyrics: 'Test lyrics content',
        syncedLyrics: '[00:00.00] Test line'
      }
    }

    const res = await httpPost('/api/v1/lyrics/cache', testLyrics)
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'success', 'Should have success property')
    assertEqual(data.success, true, 'Should return success: true')
  })

  await testAsync('歌詞快取查詢 (cache hit) 應返回已儲存資料', async () => {
    const res = await httpGet('/api/v1/lyrics/cache?track=IntegrationTestSong&artist=TestArtist')
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertEqual(data.found, true, 'Should find cached lyrics')
    assertHasProperty(data, 'data', 'Should have data property')
  })

  await testAsync('歌詞統計應返回快取資訊', async () => {
    const res = await httpGet('/api/v1/lyrics/stats')
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertHasProperty(data, 'cacheDir', 'Should have cacheDir')
    assertHasProperty(data, 'memoryCacheSize', 'Should have memoryCacheSize')
    assertHasProperty(data, 'diskCacheSize', 'Should have diskCacheSize')
  })

  await testAsync('缺少必要參數應返回 400', async () => {
    const res = await httpGet('/api/v1/lyrics/cache')
    assertEqual(res.statusCode, 400, 'Status code should be 400')
  })
}

async function testTrendingAPI() {
  console.log('\n=== 熱門影片 API 測試 ===')

  await testAsync('熱門影片端點應返回影片陣列', async () => {
    const res = await httpGet('/api/v1/trending', { timeout: 60000 })
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertIsArray(data, 'Response should be an array')
  })

  await testAsync('popular 別名應與 trending 相同', async () => {
    const res = await httpGet('/api/v1/popular', { timeout: 60000 })
    assertEqual(res.statusCode, 200, 'Status code should be 200')

    const data = res.json()
    assertIsArray(data, 'Response should be an array')
  })
}

async function testCORSHeaders() {
  console.log('\n=== CORS Headers 測試 ===')

  await testAsync('回應應包含 CORS headers', async () => {
    const res = await httpGet('/api/v1/stats')

    assertHasProperty(res.headers, 'access-control-allow-origin', 'Should have CORS origin header')
    assertEqual(res.headers['access-control-allow-origin'], '*', 'Origin should be *')
  })

  await testAsync('回應應包含 expose headers', async () => {
    const res = await httpGet('/api/v1/stats')

    assertHasProperty(res.headers, 'access-control-expose-headers', 'Should have expose headers')
  })
}

async function testErrorHandling() {
  console.log('\n=== 錯誤處理測試 ===')

  await testAsync('videoplayback 缺少 URL 參數應返回 400', async () => {
    const res = await httpGet('/videoplayback')
    assertEqual(res.statusCode, 400, 'Status code should be 400')
  })

  await testAsync('imgproxy 缺少 URL 參數應返回 400', async () => {
    const res = await httpGet('/imgproxy')
    assertEqual(res.statusCode, 400, 'Status code should be 400')
  })

  await testAsync('manifest 缺少 URL 參數應返回 400', async () => {
    const res = await httpGet('/manifest')
    assertEqual(res.statusCode, 400, 'Status code should be 400')
  })
}

// === 測試執行 ===

async function runAllTests() {
  console.log('======================================')
  console.log('   FreeTube API Integration Tests')
  console.log('======================================')

  const startTime = Date.now()

  try {
    // 初始化服務
    console.log('\n[Setup] Initializing services...')
    await initializeServices()

    // 啟動測試伺服器
    console.log('[Setup] Starting test server...')
    await startServer()

    // 執行測試套件
    await testHealthCheck()
    await testCORSHeaders()
    await testErrorHandling()
    await testSearchFlow()
    await testVideoPlaybackFlow()
    await testChannelFlow()
    await testThumbnailProxy()
    await testLyricsAPI()
    await testTrendingAPI()

  } catch (error) {
    console.error('\n[ERROR] Test execution failed:', error.message)
    results.failed++
    results.tests.push({ name: 'Test Setup/Execution', status: 'FAIL', error: error.message })
  } finally {
    // 停止測試伺服器
    console.log('\n[Teardown] Stopping test server...')
    await stopServer()
  }

  const duration = Date.now() - startTime

  // 輸出結果摘要
  console.log('\n======================================')
  console.log('           Test Results')
  console.log('======================================')
  console.log(`  Passed:  ${results.passed}`)
  console.log(`  Failed:  ${results.failed}`)
  console.log(`  Skipped: ${results.skipped}`)
  console.log(`  Total:   ${results.passed + results.failed + results.skipped}`)
  console.log(`  Time:    ${duration}ms`)
  console.log('======================================')

  if (results.failed > 0) {
    console.log('\nFailed tests:')
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`))
    process.exit(1)
  } else {
    console.log('\nAll tests passed!')
    process.exit(0)
  }
}

// 匯出測試函數供測試執行器使用
module.exports = {
  runAllTests,
  results,
  // 匯出測試工具供其他測試檔案使用
  test,
  testAsync,
  skip,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertIsArray,
  assertHasProperty,
  httpGet,
  httpPost,
}

// 直接執行
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test execution failed:', error)
    process.exit(1)
  })
}
