/**
 * 快取系統測試
 * 執行: node server/cache/cache.test.js
 */

const CacheManager = require('./index')
const MemoryCache = require('./memory')
const FileCache = require('./file')
const path = require('path')
const fs = require('fs')

// 測試結果收集
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

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

// ========== 測試套件 ==========

async function testMemoryCache() {
  console.log('\n=== MemoryCache 測試 ===')

  const cache = new MemoryCache({ defaultTTL: 1000 })

  test('set 和 get 基本操作', () => {
    cache.set('key1', 'value1')
    assertEqual(cache.get('key1'), 'value1')
  })

  test('取得不存在的鍵應返回 undefined', () => {
    assertEqual(cache.get('nonexistent'), undefined)
  })

  test('delete 刪除項目', () => {
    cache.set('key2', 'value2')
    assertTrue(cache.delete('key2'))
    assertEqual(cache.get('key2'), undefined)
  })

  test('has 檢查鍵是否存在', () => {
    cache.set('key3', 'value3')
    assertTrue(cache.has('key3'))
    assertFalse(cache.has('nonexistent'))
  })

  test('clear 清除所有快取', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    assertEqual(cache.size(), 0)
  })

  test('TTL 過期測試', async () => {
    const shortCache = new MemoryCache({ defaultTTL: 50 })
    shortCache.set('expire', 'soon')
    assertEqual(shortCache.get('expire'), 'soon')

    // 等待過期
    await new Promise(resolve => setTimeout(resolve, 100))
    assertEqual(shortCache.get('expire'), undefined)
    shortCache.destroy()
  })

  test('永久快取 (TTL = 0)', () => {
    cache.set('permanent', 'data', { ttl: 0 })
    assertTrue(cache.has('permanent'))
  })

  test('儲存物件', () => {
    const obj = { name: 'test', value: 123, nested: { a: 1 } }
    cache.set('obj', obj)
    assertEqual(cache.get('obj'), obj)
  })

  test('統計資訊', () => {
    const stats = cache.getStats()
    assertTrue(stats.hits > 0, '應有命中次數')
    assertTrue(stats.size >= 0, '應有快取大小')
  })

  cache.destroy()
}

async function testFileCache() {
  console.log('\n=== FileCache 測試 ===')

  const testCacheDir = path.join(__dirname, '.test-cache')
  const cache = new FileCache({ cacheDir: testCacheDir, defaultTTL: 60000 })

  await testAsync('set 和 get 基本操作', async () => {
    await cache.set('file-key1', 'file-value1')
    const value = await cache.get('file-key1')
    assertEqual(value, 'file-value1')
  })

  await testAsync('取得不存在的鍵應返回 undefined', async () => {
    const value = await cache.get('nonexistent-file')
    assertEqual(value, undefined)
  })

  await testAsync('delete 刪除項目', async () => {
    await cache.set('file-key2', 'file-value2')
    const deleted = await cache.delete('file-key2')
    assertTrue(deleted)
    const value = await cache.get('file-key2')
    assertEqual(value, undefined)
  })

  await testAsync('儲存複雜物件', async () => {
    const data = {
      videoId: 'abc123',
      title: '測試影片',
      duration: 300,
      metadata: { tags: ['music', 'pop'] }
    }
    await cache.set('video-data', data)
    const retrieved = await cache.get('video-data')
    assertEqual(retrieved, data)
  })

  await testAsync('同步操作', async () => {
    cache.setSync('sync-key', 'sync-value')
    const value = cache.getSync('sync-key')
    assertEqual(value, 'sync-value')
  })

  await testAsync('清除快取', async () => {
    await cache.clear()
    const size = await cache.size()
    assertEqual(size, 0)
  })

  await testAsync('統計資訊', async () => {
    const stats = cache.getStats()
    assertTrue(stats.cacheDir === testCacheDir)
  })

  // 清理測試目錄
  try {
    fs.rmSync(testCacheDir, { recursive: true, force: true })
  } catch (e) {
    // 忽略清理錯誤
  }
}

async function testCacheManager() {
  console.log('\n=== CacheManager 測試 ===')

  const testCacheDir = path.join(__dirname, '.test-manager-cache')
  const manager = new CacheManager({ cacheDir: testCacheDir })

  await testAsync('基本 set 和 get', async () => {
    await manager.set('test:key1', 'value1')
    const value = await manager.get('test:key1')
    assertEqual(value, 'value1')
  })

  await testAsync('快取搜尋結果 (僅記憶體)', async () => {
    const searchResults = [{ id: '1', title: 'Result 1' }, { id: '2', title: 'Result 2' }]
    await manager.cacheSearchResults('test query', searchResults)
    const cached = await manager.getSearchResults('test query')
    assertEqual(cached, searchResults)
  })

  await testAsync('快取影片資訊 (記憶體 + 檔案)', async () => {
    const videoInfo = {
      id: 'vid123',
      title: 'Test Video',
      duration: 180
    }
    await manager.cacheVideoInfo('vid123', videoInfo)
    const cached = await manager.getVideoInfo('vid123')
    assertEqual(cached, videoInfo)
  })

  await testAsync('快取頻道資訊', async () => {
    const channelInfo = {
      id: 'ch456',
      name: 'Test Channel',
      subscribers: 1000000
    }
    await manager.cacheChannelInfo('ch456', channelInfo)
    const cached = await manager.getChannelInfo('ch456')
    assertEqual(cached, channelInfo)
  })

  await testAsync('快取歌詞 (永久)', async () => {
    const lyrics = {
      videoId: 'lyr789',
      lines: [
        { time: 0, text: 'First line' },
        { time: 5000, text: 'Second line' }
      ]
    }
    await manager.cacheLyrics('lyr789', lyrics)
    const cached = await manager.getLyrics('lyr789')
    assertEqual(cached, lyrics)
  })

  await testAsync('delete 刪除項目', async () => {
    await manager.set('video:delete-test', 'to be deleted', { type: 'video' })
    await manager.delete('video:delete-test', { type: 'video' })
    const value = await manager.get('video:delete-test', { type: 'video' })
    assertEqual(value, undefined)
  })

  await testAsync('同步操作', async () => {
    manager.setSync('sync:key', 'sync-value')
    const value = manager.getSync('sync:key')
    assertEqual(value, 'sync-value')
  })

  await testAsync('統計資訊', async () => {
    const stats = manager.getStats()
    assertTrue(stats.manager !== undefined, '應有 manager 統計')
    assertTrue(stats.memory !== undefined, '應有 memory 統計')
    assertTrue(stats.file !== undefined, '應有 file 統計')
    assertTrue(stats.manager.totalGets > 0, '應有 get 次數')
    assertTrue(stats.manager.totalSets > 0, '應有 set 次數')
    console.log('    統計:', JSON.stringify(stats.manager, null, 2))
  })

  await testAsync('清除所有快取', async () => {
    await manager.clear()
    const value = await manager.get('test:key1')
    assertEqual(value, undefined)
  })

  manager.destroy()

  // 清理測試目錄
  try {
    fs.rmSync(testCacheDir, { recursive: true, force: true })
  } catch (e) {
    // 忽略清理錯誤
  }
}

async function testCacheStrategies() {
  console.log('\n=== 快取策略測試 ===')

  const { CACHE_TYPES, DEFAULT_TTL } = require('./index')

  test('搜尋結果 TTL 為 5 分鐘', () => {
    assertEqual(DEFAULT_TTL[CACHE_TYPES.SEARCH], 5 * 60 * 1000)
  })

  test('影片資訊 TTL 為 1 小時', () => {
    assertEqual(DEFAULT_TTL[CACHE_TYPES.VIDEO], 60 * 60 * 1000)
  })

  test('頻道資訊 TTL 為 24 小時', () => {
    assertEqual(DEFAULT_TTL[CACHE_TYPES.CHANNEL], 24 * 60 * 60 * 1000)
  })

  test('歌詞 TTL 為 0 (永久)', () => {
    assertEqual(DEFAULT_TTL[CACHE_TYPES.LYRICS], 0)
  })
}

// ========== 執行測試 ==========

async function runAllTests() {
  console.log('======================================')
  console.log('       快取系統測試')
  console.log('======================================')

  const startTime = Date.now()

  await testMemoryCache()
  await testFileCache()
  await testCacheManager()
  await testCacheStrategies()

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
