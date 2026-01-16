/**
 * API Routes 測試
 * 測試所有 API 端點的功能與錯誤處理
 * 執行: node server/routes/routes.test.js
 */

const {
  toProxyUrl,
  toGgphtProxyUrl,
  toVideoThumbnailProxyUrl,
  convertSearchResults,
  convertRelatedVideos,
  convertChannelVideos,
  createAuthorThumbnails,
  generateDashManifest,
  parseDuration,
  escapeXml,
  handleRequest,
} = require('./index')

// ========== 測試框架 ==========

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
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    console.log(`  \x1b[31m✗\x1b[0m ${name}`)
    console.log(`    \x1b[31mError: ${error.message}\x1b[0m`)
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
    console.log(`    \x1b[31mError: ${error.message}\x1b[0m`)
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

function assertType(value, type, message) {
  if (typeof value !== type) {
    throw new Error(message || `Expected type ${type}, got ${typeof value}`)
  }
}

function assertArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message || `Expected array, got ${typeof value}`)
  }
}

// ========== Mock 工具 ==========

function createMockRequest(method = 'GET', headers = {}) {
  return {
    method,
    headers,
    on: (event, handler) => {
      if (event === 'data') {
        // 不發送任何資料
      } else if (event === 'end') {
        handler()
      }
    }
  }
}

function createMockResponse() {
  const response = {
    statusCode: null,
    headers: {},
    body: '',
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode
      Object.assign(this.headers, headers)
    },
    end(body = '') {
      this.body = body
      this.ended = true
    },
    getJSON() {
      try {
        return JSON.parse(this.body)
      } catch {
        return null
      }
    }
  }
  return response
}

function createMockInnertube(overrides = {}) {
  return {
    search: async (q) => {
      if (!q) return { results: [] }
      return {
        results: [
          {
            type: 'Video',
            id: 'test123',
            title: { text: 'Test Video' },
            author: { name: 'Test Channel', id: 'UC123' },
            view_count: { text: '1,000 views' },
            published: { text: '1 day ago' },
            duration: { seconds: 180 },
            is_live: false,
          }
        ]
      }
    },
    getSearchSuggestions: async (q) => {
      return [`${q} suggestion 1`, `${q} suggestion 2`]
    },
    getTrending: async () => {
      return {
        videos: [
          {
            type: 'Video',
            id: 'trending1',
            title: { text: 'Trending Video 1' },
            author: { name: 'Popular Channel', id: 'UC456' },
            view_count: { text: '1M views' },
            duration: { seconds: 300 },
          }
        ]
      }
    },
    getInfo: async (videoId) => {
      return {
        basic_info: {
          id: videoId,
          title: 'Test Video',
          channel_id: 'UC123',
          duration: 180,
        },
        watch_next_feed: [],
        secondary_info: {
          owner: {
            author: {
              id: 'UC123',
              thumbnails: [{ url: 'https://yt3.ggpht.com/test' }]
            }
          }
        }
      }
    },
    getChannel: async (channelId) => {
      return {
        metadata: {
          title: 'Test Channel',
          description: 'A test channel',
          avatar: [{ url: 'https://yt3.ggpht.com/avatar' }],
          banner: [{ url: 'https://yt3.ggpht.com/banner' }],
          subscriber_count: '1.5M',
          is_family_safe: true,
        },
        has_videos: true,
        has_shorts: false,
        has_live_streams: false,
        has_playlists: true,
        has_community: false,
        getVideos: async () => ({
          videos: [
            {
              id: 'vid1',
              title: { text: 'Channel Video 1' },
              view_count: { text: '10K views' },
              published: { text: '2 days ago' },
              duration: { seconds: 240 },
            }
          ],
          has_continuation: false,
        }),
        getPlaylists: async () => ({
          playlists: [
            {
              id: 'PL123',
              title: { text: 'Test Playlist' },
              first_video_id: 'vid1',
              video_count: 10,
            }
          ],
          has_continuation: false,
        }),
      }
    },
    ...overrides
  }
}

function createMockInnertubeAndroid(overrides = {}) {
  return {
    getBasicInfo: async (videoId) => {
      return {
        basic_info: {
          id: videoId,
          title: 'Test Video',
          author: 'Test Channel',
          channel_id: 'UC123',
          short_description: 'Test description',
          view_count: 1000,
          like_count: 100,
          duration: 180,
          category: 'Music',
          keywords: ['test', 'video'],
          is_live: false,
          is_upcoming: false,
        },
        streaming_data: {
          formats: [
            {
              url: 'https://example.com/video.mp4',
              itag: 22,
              mime_type: 'video/mp4',
              quality_label: '720p',
              quality: 'hd720',
              width: 1280,
              height: 720,
              codecs: 'avc1.64001F, mp4a.40.2',
            }
          ],
          adaptive_formats: [
            {
              url: 'https://example.com/video-only.mp4',
              itag: 137,
              mime_type: 'video/mp4; codecs="avc1.640028"',
              bitrate: 4000000,
              width: 1920,
              height: 1080,
              quality_label: '1080p',
              fps: 30,
              init_range: { start: 0, end: 740 },
              index_range: { start: 741, end: 1500 },
              content_length: 50000000,
            },
            {
              url: 'https://example.com/audio.mp4',
              itag: 140,
              mime_type: 'audio/mp4; codecs="mp4a.40.2"',
              bitrate: 128000,
              audio_quality: 'AUDIO_QUALITY_MEDIUM',
              audio_sample_rate: 44100,
              audio_channels: 2,
              init_range: { start: 0, end: 640 },
              index_range: { start: 641, end: 1200 },
              content_length: 5000000,
            }
          ],
          hls_manifest_url: null,
        },
        playability_status: {
          status: 'OK',
        },
      }
    },
    ...overrides
  }
}

// ========== 工具函數測試 ==========

function testUtilityFunctions() {
  console.log('\n\x1b[36m=== 工具函數測試 ===\x1b[0m')

  test('toProxyUrl: 正常 URL 轉換', () => {
    const url = 'https://example.com/video.mp4'
    const proxyUrl = toProxyUrl(url)
    assertContains(proxyUrl, '/videoplayback?url=')
    // 驗證可以解碼回原始 URL
    const encoded = proxyUrl.replace('/videoplayback?url=', '')
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    assertEqual(decoded, url)
  })

  test('toProxyUrl: 空字串應回傳空字串', () => {
    assertEqual(toProxyUrl(''), '')
    assertEqual(toProxyUrl(null), '')
    assertEqual(toProxyUrl(undefined), '')
  })

  test('toGgphtProxyUrl: yt3.ggpht.com URL 轉換', () => {
    const url = 'https://yt3.ggpht.com/abc123'
    const proxyUrl = toGgphtProxyUrl(url)
    assertEqual(proxyUrl, '/ggpht/abc123')
  })

  test('toGgphtProxyUrl: 協議相對 URL 處理', () => {
    const url = '//yt3.ggpht.com/abc123'
    const proxyUrl = toGgphtProxyUrl(url)
    assertEqual(proxyUrl, '/ggpht/abc123')
  })

  test('toGgphtProxyUrl: googleusercontent.com URL 轉換', () => {
    const url = 'https://lh3.googleusercontent.com/test'
    const proxyUrl = toGgphtProxyUrl(url)
    assertContains(proxyUrl, '/imgproxy?url=')
  })

  test('toGgphtProxyUrl: 空字串處理', () => {
    assertEqual(toGgphtProxyUrl(''), '')
    assertEqual(toGgphtProxyUrl(null), '')
  })

  test('toVideoThumbnailProxyUrl: i.ytimg.com URL 轉換', () => {
    const url = 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg'
    const proxyUrl = toVideoThumbnailProxyUrl(url)
    assertEqual(proxyUrl, '/vi/abc123/maxresdefault.jpg')
  })

  test('toVideoThumbnailProxyUrl: vi_webp 格式', () => {
    const url = 'https://i.ytimg.com/vi_webp/abc123/maxresdefault.webp'
    const proxyUrl = toVideoThumbnailProxyUrl(url)
    assertEqual(proxyUrl, '/vi_webp/abc123/maxresdefault.webp')
  })

  test('toVideoThumbnailProxyUrl: 非 ytimg URL 保持不變', () => {
    const url = 'https://other.com/image.jpg'
    assertEqual(toVideoThumbnailProxyUrl(url), url)
  })

  test('parseDuration: MM:SS 格式', () => {
    assertEqual(parseDuration('3:45'), 225)
    assertEqual(parseDuration('0:30'), 30)
  })

  test('parseDuration: HH:MM:SS 格式', () => {
    assertEqual(parseDuration('1:30:45'), 5445)
    assertEqual(parseDuration('2:00:00'), 7200)
  })

  test('parseDuration: 空值處理', () => {
    assertEqual(parseDuration(''), 0)
    assertEqual(parseDuration(null), 0)
    assertEqual(parseDuration(undefined), 0)
  })

  test('escapeXml: 特殊字元轉義', () => {
    assertEqual(escapeXml('a & b'), 'a &amp; b')
    assertEqual(escapeXml('<tag>'), '&lt;tag&gt;')
    assertEqual(escapeXml('"quoted"'), '&quot;quoted&quot;')
    assertEqual(escapeXml("it's"), "it&apos;s")
  })

  test('escapeXml: 空值處理', () => {
    assertEqual(escapeXml(''), '')
    assertEqual(escapeXml(null), '')
    assertEqual(escapeXml(undefined), '')
  })

  test('createAuthorThumbnails: 產生正確尺寸', () => {
    const thumbnails = createAuthorThumbnails('https://yt3.ggpht.com/test')
    assertEqual(thumbnails.length, 4)
    assertEqual(thumbnails[0].width, 32)
    assertEqual(thumbnails[1].width, 48)
    assertEqual(thumbnails[2].width, 76)
    assertEqual(thumbnails[3].width, 176)
  })

  test('createAuthorThumbnails: 空值回傳空陣列', () => {
    assertEqual(createAuthorThumbnails(''), [])
    assertEqual(createAuthorThumbnails(null), [])
  })
}

// ========== 轉換函數測試 ==========

function testConversionFunctions() {
  console.log('\n\x1b[36m=== 轉換函數測試 ===\x1b[0m')

  test('convertSearchResults: 影片類型轉換', () => {
    const results = [
      {
        type: 'Video',
        id: 'test123',
        title: { text: 'Test Video' },
        author: { name: 'Test Channel', id: 'UC123' },
        view_count: { text: '1,000 views' },
        published: { text: '1 day ago' },
        duration: { seconds: 180 },
        is_live: false,
      }
    ]
    const converted = convertSearchResults(results)
    assertEqual(converted.length, 1)
    assertEqual(converted[0].type, 'video')
    assertEqual(converted[0].videoId, 'test123')
    assertEqual(converted[0].title, 'Test Video')
    assertEqual(converted[0].author, 'Test Channel')
    assertEqual(converted[0].authorId, 'UC123')
    assertEqual(converted[0].lengthSeconds, 180)
    assertFalse(converted[0].liveNow)
  })

  test('convertSearchResults: 頻道類型轉換', () => {
    const results = [
      {
        type: 'Channel',
        author: {
          name: 'Test Channel',
          id: 'UC123',
          thumbnails: [{ url: 'https://yt3.ggpht.com/avatar' }]
        },
        subscriber_count: { text: '1.5M' },
        video_count: { text: '500' },
        description: 'Channel description',
      }
    ]
    const converted = convertSearchResults(results)
    assertEqual(converted.length, 1)
    assertEqual(converted[0].type, 'channel')
    assertEqual(converted[0].author, 'Test Channel')
    assertEqual(converted[0].authorId, 'UC123')
    assertTrue(converted[0].authorThumbnails.length > 0)
  })

  test('convertSearchResults: 播放清單類型轉換', () => {
    const results = [
      {
        type: 'Playlist',
        id: 'PL123',
        title: { text: 'Test Playlist' },
        author: { name: 'Test Channel', id: 'UC123' },
        video_count: 25,
      }
    ]
    const converted = convertSearchResults(results)
    assertEqual(converted.length, 1)
    assertEqual(converted[0].type, 'playlist')
    assertEqual(converted[0].playlistId, 'PL123')
    assertEqual(converted[0].videoCount, 25)
  })

  test('convertSearchResults: 空陣列處理', () => {
    assertEqual(convertSearchResults([]), [])
    assertEqual(convertSearchResults(null), [])
    assertEqual(convertSearchResults(undefined), [])
  })

  test('convertRelatedVideos: 過濾播放清單類型', () => {
    const related = [
      { type: 'Playlist', id: 'PL1' },
      { type: 'CompactPlaylist', id: 'PL2' },
      { type: 'Mix', id: 'MX1' },
      { type: 'CompactVideo', id: 'vid1', title: { text: 'Video' } },
    ]
    const converted = convertRelatedVideos(related)
    assertEqual(converted.length, 1)
    assertEqual(converted[0].videoId, 'vid1')
  })

  test('convertRelatedVideos: CompactVideo 處理', () => {
    const related = [
      {
        type: 'CompactVideo',
        id: 'vid1',
        title: { text: 'Related Video' },
        author: { name: 'Channel', id: 'UC456' },
        view_count: { text: '500K views' },
        published: { text: '3 days ago' },
        duration: { seconds: 240 },
      }
    ]
    const converted = convertRelatedVideos(related)
    assertEqual(converted.length, 1)
    assertEqual(converted[0].videoId, 'vid1')
    assertEqual(converted[0].title, 'Related Video')
    assertEqual(converted[0].lengthSeconds, 240)
  })

  test('convertRelatedVideos: 空陣列處理', () => {
    assertEqual(convertRelatedVideos([]), [])
    assertEqual(convertRelatedVideos(null), [])
  })

  test('convertChannelVideos: 正常轉換', () => {
    const videos = [
      {
        id: 'vid1',
        title: { text: 'Channel Video' },
        view_count: { text: '10K views' },
        published: { text: '2 days ago' },
        duration: { seconds: 180 },
        is_live: false,
      }
    ]
    const converted = convertChannelVideos(videos, 'UC123')
    assertEqual(converted.length, 1)
    assertEqual(converted[0].videoId, 'vid1')
    assertEqual(converted[0].authorId, 'UC123')
    assertEqual(converted[0].type, 'video')
  })

  test('convertChannelVideos: 觀看次數解析', () => {
    const videos = [
      { id: 'v1', title: { text: 'T' }, view_count: { text: '1.5K views' } },
      { id: 'v2', title: { text: 'T' }, view_count: { text: '2M views' } },
      { id: 'v3', title: { text: 'T' }, view_count: { text: '1,000 views' } },
    ]
    const converted = convertChannelVideos(videos, 'UC1')
    assertEqual(converted[0].viewCount, 1500)
    assertEqual(converted[1].viewCount, 2000000)
    assertEqual(converted[2].viewCount, 1000)
  })
}

// ========== DASH Manifest 測試 ==========

function testDashManifest() {
  console.log('\n\x1b[36m=== DASH Manifest 測試 ===\x1b[0m')

  test('generateDashManifest: 基本結構', () => {
    const adaptiveFormats = [
      {
        url: 'https://example.com/video.mp4',
        itag: 137,
        mime_type: 'video/mp4; codecs="avc1.640028"',
        bitrate: 4000000,
        width: 1920,
        height: 1080,
        init_range: { start: 0, end: 740 },
        index_range: { start: 741, end: 1500 },
      },
      {
        url: 'https://example.com/audio.mp4',
        itag: 140,
        mime_type: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 128000,
        init_range: { start: 0, end: 640 },
        index_range: { start: 641, end: 1200 },
      }
    ]
    const manifest = generateDashManifest('test123', adaptiveFormats, 300)

    assertContains(manifest, '<?xml version="1.0"')
    assertContains(manifest, '<MPD')
    assertContains(manifest, '<Period')
    assertContains(manifest, '<AdaptationSet')
    assertContains(manifest, '<Representation')
    assertContains(manifest, 'mimeType="video/mp4"')
    assertContains(manifest, 'mimeType="audio/mp4"')
  })

  test('generateDashManifest: Duration 格式', () => {
    const adaptiveFormats = []
    const manifest = generateDashManifest('test', adaptiveFormats, 3661) // 1h 1m 1s

    assertContains(manifest, 'PT1H1M1S')
  })

  test('generateDashManifest: 空格式處理', () => {
    const manifest = generateDashManifest('test', [], 0)
    assertContains(manifest, '<MPD')
    assertContains(manifest, '<Period')
  })
}

// ========== Search API 測試 ==========

async function testSearchAPI() {
  console.log('\n\x1b[36m=== Search API 測試 ===\x1b[0m')

  await testAsync('正常搜尋', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/search',
      query: { q: 'test query' },
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled, '路由應被處理')
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()
    assertArray(json)
    assertTrue(json.length > 0, '應回傳搜尋結果')
    assertEqual(json[0].type, 'video')
  })

  await testAsync('空 query 處理', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/search',
      query: { q: '' },
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()
    assertArray(json)
    assertEqual(json.length, 0, '空 query 應回傳空陣列')
  })

  await testAsync('特殊字元編碼', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const searchQuery = '中文搜尋 & special <characters>'
    const innertube = createMockInnertube({
      search: async (q) => {
        assertEqual(q, searchQuery, 'query 應正確傳遞')
        return { results: [] }
      }
    })
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/search',
      query: { q: searchQuery },
      innertube,
      innertubeAndroid,
    })

    assertEqual(res.statusCode, 200)
  })

  await testAsync('搜尋建議', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/search/suggestions',
      query: { q: 'test' },
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()
    assertTrue(json.query === 'test')
    assertArray(json.suggestions)
  })
}

// ========== Videos API 測試 ==========

async function testVideosAPI() {
  console.log('\n\x1b[36m=== Videos API 測試 ===\x1b[0m')

  await testAsync('正常取得影片資訊', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/videos/test123',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()
    assertEqual(json.type, 'video')
    assertEqual(json.videoId, 'test123')
    assertTrue(json.title !== undefined)
    assertTrue(json.author !== undefined)
    assertTrue(json.lengthSeconds !== undefined)
  })

  await testAsync('回傳格式驗證', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/videos/abc123',
      query: {},
      innertube,
      innertubeAndroid,
    })

    const json = res.getJSON()

    // 驗證必要欄位
    assertTrue('videoId' in json, '應有 videoId')
    assertTrue('title' in json, '應有 title')
    assertTrue('author' in json, '應有 author')
    assertTrue('authorId' in json, '應有 authorId')
    assertTrue('authorUrl' in json, '應有 authorUrl')
    assertTrue('lengthSeconds' in json, '應有 lengthSeconds')
    assertTrue('viewCount' in json, '應有 viewCount')
    assertTrue('description' in json, '應有 description')
    assertTrue('adaptiveFormats' in json, '應有 adaptiveFormats')
    assertTrue('formatStreams' in json, '應有 formatStreams')
    assertTrue('recommendedVideos' in json, '應有 recommendedVideos')
    assertArray(json.adaptiveFormats)
    assertArray(json.formatStreams)
  })

  await testAsync('無效 ID 處理 (模擬錯誤)', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid({
      getBasicInfo: async () => {
        throw new Error('Video not found')
      }
    })

    let errorThrown = false
    try {
      await handleRequest({
        req, res,
        path: '/api/v1/videos/invalid',
        query: {},
        innertube,
        innertubeAndroid,
      })
    } catch (e) {
      errorThrown = true
    }

    assertTrue(errorThrown, '應拋出錯誤')
  })

  await testAsync('串流格式 URL 轉換', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/videos/test456',
      query: {},
      innertube,
      innertubeAndroid,
    })

    const json = res.getJSON()

    // 驗證 URL 已轉換為代理格式
    if (json.formatStreams.length > 0) {
      assertContains(json.formatStreams[0].url, '/videoplayback?url=')
    }
    if (json.adaptiveFormats.length > 0) {
      assertContains(json.adaptiveFormats[0].url, '/videoplayback?url=')
    }
  })

  await testAsync('不可播放影片錯誤訊息', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid({
      getBasicInfo: async (videoId) => {
        return {
          basic_info: {
            id: videoId,
            title: 'Unavailable Video',
          },
          streaming_data: null,
          playability_status: {
            status: 'UNPLAYABLE',
            reason: 'This video is unavailable',
          },
        }
      }
    })

    await handleRequest({
      req, res,
      path: '/api/v1/videos/blocked',
      query: {},
      innertube,
      innertubeAndroid,
    })

    const json = res.getJSON()
    assertEqual(json.playabilityStatus, 'UNPLAYABLE')
    assertTrue(json.errorMessage !== null)
  })
}

// ========== Channels API 測試 ==========

async function testChannelsAPI() {
  console.log('\n\x1b[36m=== Channels API 測試 ===\x1b[0m')

  await testAsync('取得頻道資訊', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/channels/UC123',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()

    assertTrue('author' in json, '應有 author')
    assertTrue('authorId' in json, '應有 authorId')
    assertEqual(json.authorId, 'UC123')
    assertTrue('description' in json, '應有 description')
    assertTrue('tabs' in json, '應有 tabs')
    assertArray(json.tabs)
    assertTrue('latestVideos' in json, '應有 latestVideos')
    assertArray(json.latestVideos)
  })

  await testAsync('頻道影片列表', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/channels/UC123/videos',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()

    assertTrue('videos' in json, '應有 videos')
    assertArray(json.videos)
  })

  await testAsync('頻道播放清單', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/channels/UC123/playlists',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()

    assertTrue('playlists' in json, '應有 playlists')
    assertArray(json.playlists)
  })

  await testAsync('頻道錯誤處理', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube({
      getChannel: async () => {
        throw new Error('Channel not found')
      }
    })
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/channels/invalid',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertEqual(res.statusCode, 500)
    const json = res.getJSON()
    assertTrue('error' in json)
  })

  await testAsync('無效子資源處理', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/channels/UC123/invalid',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertEqual(res.statusCode, 404)
    const json = res.getJSON()
    assertTrue('error' in json)
    assertContains(json.error, 'Unknown sub-resource')
  })
}

// ========== Trending API 測試 ==========

async function testTrendingAPI() {
  console.log('\n\x1b[36m=== Trending API 測試 ===\x1b[0m')

  await testAsync('取得熱門影片', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/trending',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()
    assertArray(json)
  })

  await testAsync('popular 端點 (別名)', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/popular',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
  })

  await testAsync('Trending 錯誤 fallback', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube({
      getTrending: async () => {
        throw new Error('Trending unavailable')
      },
      search: async () => ({
        results: [
          { type: 'Video', id: 'fallback1', title: { text: 'Fallback' } }
        ]
      })
    })
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/trending',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertEqual(res.statusCode, 200)
    const json = res.getJSON()
    assertArray(json)
  })
}

// ========== Stats API 測試 ==========

async function testStatsAPI() {
  console.log('\n\x1b[36m=== Stats API 測試 ===\x1b[0m')

  await testAsync('取得統計資訊', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/stats',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()

    assertTrue('version' in json, '應有 version')
    assertTrue('software' in json, '應有 software')
    assertEqual(json.software.name, 'freetube-local-api')
  })
}

// ========== Lyrics API 測試 ==========

async function testLyricsAPI() {
  console.log('\n\x1b[36m=== Lyrics API 測試 ===\x1b[0m')

  await testAsync('取得歌詞統計', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/lyrics/stats',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
    const json = res.getJSON()

    assertTrue('cacheDir' in json, '應有 cacheDir')
    assertTrue('memoryCacheSize' in json, '應有 memoryCacheSize')
    assertTrue('diskCacheSize' in json, '應有 diskCacheSize')
  })

  await testAsync('歌詞快取 GET - 缺少 track 參數', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/lyrics/cache',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertEqual(res.statusCode, 400)
    const json = res.getJSON()
    assertTrue('error' in json)
  })

  await testAsync('歌詞搜尋 - 缺少 q 參數', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/lyrics/search',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertEqual(res.statusCode, 400)
    const json = res.getJSON()
    assertTrue('error' in json)
  })

  await testAsync('歌詞 fetch - 缺少 track 參數', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    await handleRequest({
      req, res,
      path: '/api/v1/lyrics/fetch',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertEqual(res.statusCode, 400)
    const json = res.getJSON()
    assertTrue('error' in json)
  })
}

// ========== Proxy 端點測試 ==========

async function testProxyEndpoints() {
  console.log('\n\x1b[36m=== Proxy 端點測試 ===\x1b[0m')

  await testAsync('videoplayback - 缺少 url 參數', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/videoplayback',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 400)
    const json = res.getJSON()
    assertTrue('error' in json)
  })

  await testAsync('imgproxy - 缺少 url 參數', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/imgproxy',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 400)
  })

  await testAsync('manifest - 缺少 url 參數', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/manifest',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 400)
  })
}

// ========== 路由匹配測試 ==========

async function testRouteMatching() {
  console.log('\n\x1b[36m=== 路由匹配測試 ===\x1b[0m')

  await testAsync('未匹配路由回傳 false', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/nonexistent',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertFalse(handled, '未匹配路由應回傳 false')
  })

  await testAsync('尾部斜線處理 - search/', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/search/',
      query: { q: 'test' },
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
  })

  await testAsync('尾部斜線處理 - trending/', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    const handled = await handleRequest({
      req, res,
      path: '/api/v1/trending/',
      query: {},
      innertube,
      innertubeAndroid,
    })

    assertTrue(handled)
    assertEqual(res.statusCode, 200)
  })

  await testAsync('Video ID 格式匹配', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    const innertube = createMockInnertube()
    const innertubeAndroid = createMockInnertubeAndroid()

    // 測試各種 YouTube ID 格式
    const testIds = ['dQw4w9WgXcQ', 'abc_123-XYZ', '12345678901']

    for (const id of testIds) {
      const handled = await handleRequest({
        req, res,
        path: `/api/v1/videos/${id}`,
        query: {},
        innertube,
        innertubeAndroid,
      })
      assertTrue(handled, `應匹配 ID: ${id}`)
    }
  })
}

// ========== 執行所有測試 ==========

async function runAllTests() {
  console.log('\x1b[1m======================================\x1b[0m')
  console.log('\x1b[1m       API Routes 測試\x1b[0m')
  console.log('\x1b[1m======================================\x1b[0m')

  const startTime = Date.now()

  // 同步測試
  testUtilityFunctions()
  testConversionFunctions()
  testDashManifest()

  // 非同步測試
  await testSearchAPI()
  await testVideosAPI()
  await testChannelsAPI()
  await testTrendingAPI()
  await testStatsAPI()
  await testLyricsAPI()
  await testProxyEndpoints()
  await testRouteMatching()

  const duration = Date.now() - startTime

  console.log('\n\x1b[1m======================================\x1b[0m')
  console.log('\x1b[1m       測試結果\x1b[0m')
  console.log('\x1b[1m======================================\x1b[0m')
  console.log(`  \x1b[32m通過: ${results.passed}\x1b[0m`)
  console.log(`  \x1b[31m失敗: ${results.failed}\x1b[0m`)
  console.log(`  總計: ${results.passed + results.failed}`)
  console.log(`  耗時: ${duration}ms`)
  console.log('\x1b[1m======================================\x1b[0m')

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
