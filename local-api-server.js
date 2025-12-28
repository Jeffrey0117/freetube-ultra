/**
 * FreeTube Local API + Video Proxy Server
 * 用 youtubei.js 直接打 YouTube API，並代理影片串流
 */

const http = require('http')
const https = require('https')
const { Innertube, ClientType } = require('youtubei.js')

const PORT = 3001
const HOST_IP = '192.168.0.181' // 改成你的電腦 IP

let innertube = null
let innertubeAndroid = null

// 初始化 YouTube.js
async function initInnertube() {
  console.log('Initializing YouTube.js...')

  // 一般用途 (搜尋等)
  innertube = await Innertube.create({
    lang: 'zh-TW',
    location: 'TW',
    retrieve_player: false,
  })

  // Android client - URLs 不需要解密
  innertubeAndroid = await Innertube.create({
    lang: 'zh-TW',
    location: 'TW',
    client_type: ClientType.ANDROID,
    retrieve_player: false,
  })

  console.log('YouTube.js ready!')
}

// 解析 URL 參數
function parseQuery(url) {
  const queryString = url.split('?')[1] || ''
  const params = {}
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=')
    if (key) params[key] = decodeURIComponent(value || '')
  })
  return params
}

// 將原始 YouTube URL 轉換為 Proxy URL
function toProxyUrl(originalUrl) {
  if (!originalUrl) return ''
  const encoded = Buffer.from(originalUrl).toString('base64url')
  return `http://${HOST_IP}:${PORT}/videoplayback?url=${encoded}`
}

// 轉換搜尋結果為 Invidious 格式
function convertSearchResults(results) {
  return results.map(item => {
    if (item.type === 'Video') {
      const videoId = item.id
      // 使用相對路徑，會透過 proxy 代理
      const videoThumbnails = [
        { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
        { quality: 'maxresdefault', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
        { quality: 'sddefault', url: `/vi/${videoId}/sddefault.jpg`, width: 640, height: 480 },
        { quality: 'high', url: `/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
        { quality: 'medium', url: `/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
        { quality: 'default', url: `/vi/${videoId}/default.jpg`, width: 120, height: 90 },
      ]
      return {
        type: 'video',
        title: item.title?.text || '',
        videoId: videoId,
        author: item.author?.name || '',
        authorId: item.author?.id || '',
        authorUrl: `/channel/${item.author?.id || ''}`,
        videoThumbnails: videoThumbnails,
        description: item.description || '',
        viewCount: parseInt(item.view_count?.text?.replace(/[^0-9]/g, '') || '0'),
        viewCountText: item.view_count?.text || '',
        published: item.published?.text || '',
        publishedText: item.published?.text || '',
        lengthSeconds: item.duration?.seconds || 0,
        liveNow: item.is_live || false,
      }
    } else if (item.type === 'Channel') {
      // 確保 thumbnails 格式正確 (需要至少 3 個有 .url 的物件)
      const rawThumbs = item.author?.thumbnails || []
      let thumbUrl = rawThumbs[0]?.url || ''
      // 修正 protocol-relative URL 並轉為 proxy 路徑
      if (thumbUrl.startsWith('//')) {
        thumbUrl = 'https:' + thumbUrl
      }
      // 使用 ggpht proxy
      if (thumbUrl.includes('yt3.ggpht.com')) {
        const ggphtPath = thumbUrl.replace(/^https?:\/\/yt3\.ggpht\.com/, '')
        thumbUrl = `/ggpht${ggphtPath}`
      }
      // FreeTube 需要 authorThumbnails[2].url，所以確保有 3 個
      const authorThumbnails = [
        { url: thumbUrl, width: 32, height: 32 },
        { url: thumbUrl, width: 48, height: 48 },
        { url: thumbUrl, width: 76, height: 76 },
        { url: thumbUrl, width: 176, height: 176 },
      ]

      return {
        type: 'channel',
        author: item.author?.name || '',
        authorId: item.author?.id || '',
        authorUrl: `/channel/${item.author?.id || ''}`,
        authorThumbnails: authorThumbnails,
        subCount: item.subscriber_count?.text || '',
        videoCount: item.video_count?.text || '',
        description: item.description || '',
      }
    } else if (item.type === 'Playlist') {
      return {
        type: 'playlist',
        title: item.title?.text || '',
        playlistId: item.id,
        author: item.author?.name || '',
        authorId: item.author?.id || '',
        videoCount: item.video_count || 0,
      }
    }
    return null
  }).filter(Boolean)
}

// 轉換相關影片為 Invidious 格式
function convertRelatedVideos(relatedVideos) {
  if (!relatedVideos || !Array.isArray(relatedVideos)) return []

  return relatedVideos.map(item => {
    // 支援多種格式
    let videoId, title, author, authorId, viewCountText, durationSeconds, publishedText

    if (item.type === 'LockupView') {
      // 新版 YouTube 格式
      videoId = item.content_id
      if (!videoId) return null

      // 從 metadata 提取資訊 (LockupViewModel 結構)
      const meta = item.metadata
      // title 在 meta.title.text
      title = meta?.title?.text || ''

      // author 和其他 metadata 在 meta.metadata (LockupMetadataView)
      const metaView = meta?.metadata
      if (metaView?.metadata_rows) {
        // 第一行通常是頻道名稱
        const row0 = metaView.metadata_rows[0]
        author = row0?.metadata_parts?.[0]?.text?.content || ''
        authorId = row0?.metadata_parts?.[0]?.text?.command?.inner_endpoint?.browse_id || ''

        // 第二行通常是觀看數和發布時間
        const row1 = metaView.metadata_rows[1]
        viewCountText = row1?.metadata_parts?.[0]?.text?.content || ''
        publishedText = row1?.metadata_parts?.[1]?.text?.content || ''
      } else {
        author = ''
        authorId = ''
        viewCountText = ''
        publishedText = ''
      }

      // 從 content_image 提取時長
      const overlay = item.content_image?.decorations?.[0]
      durationSeconds = overlay?.type === 'ThumbnailOverlayBadgeView'
        ? parseDuration(overlay?.text)
        : 0

    } else if (item.type === 'CompactVideo' || item.type === 'Video') {
      // 舊版格式
      videoId = item.id || item.video_id
      if (!videoId) return null

      title = item.title?.text || item.title || ''
      author = item.author?.name || item.author || ''
      authorId = item.author?.id || ''
      viewCountText = item.view_count?.text || item.short_view_count?.text || ''
      publishedText = item.published?.text || ''
      durationSeconds = item.duration?.seconds || 0

    } else {
      // 其他類型嘗試通用提取
      videoId = item.id || item.video_id || item.content_id
      if (!videoId) return null

      title = item.title?.text || item.title || ''
      author = item.author?.name || item.author || ''
      authorId = item.author?.id || ''
      viewCountText = ''
      publishedText = ''
      durationSeconds = 0
    }

    // 使用相對路徑，透過 proxy 代理
    const videoThumbnails = [
      { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
      { quality: 'high', url: `/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
      { quality: 'medium', url: `/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
      { quality: 'default', url: `/vi/${videoId}/default.jpg`, width: 120, height: 90 },
    ]

    return {
      videoId: videoId,
      title: title,
      author: author,
      authorId: authorId,
      authorUrl: `/channel/${authorId}`,
      authorThumbnails: [],
      videoThumbnails: videoThumbnails,
      viewCount: parseInt(viewCountText?.replace(/[^0-9]/g, '') || '0'),
      viewCountText: viewCountText,
      lengthSeconds: durationSeconds,
      published: publishedText,
      publishedText: publishedText,
    }
  }).filter(Boolean)
}

// 解析時長字串 (例如 "3:45" -> 225)
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

// 轉換影片資訊為 Invidious 格式 (含 Proxy URL)
async function convertVideoInfo(info, relatedVideos) {
  const details = info.basic_info
  const streaming = info.streaming_data

  // 格式化串流 - 使用 proxy URL
  const formatStreams = []
  const adaptiveFormats = []

  if (streaming?.formats) {
    for (const f of streaming.formats) {
      formatStreams.push({
        url: toProxyUrl(f.url),
        itag: f.itag,
        type: f.mime_type,
        quality: f.quality_label || f.quality,
        container: f.mime_type?.split('/')[1]?.split(';')[0] || 'mp4',
        encoding: f.codecs,
        resolution: f.quality_label || '',
        qualityLabel: f.quality_label || f.quality,
        size: `${f.width}x${f.height}`,
      })
    }
  }

  if (streaming?.adaptive_formats) {
    for (const f of streaming.adaptive_formats) {
      adaptiveFormats.push({
        url: toProxyUrl(f.url),
        itag: f.itag,
        type: f.mime_type,
        bitrate: f.bitrate,
        width: f.width,
        height: f.height,
        container: f.mime_type?.split('/')[1]?.split(';')[0] || '',
        encoding: f.codecs,
        qualityLabel: f.quality_label || '',
        resolution: f.quality_label || `${f.height}p`,
        fps: f.fps,
        audioQuality: f.audio_quality,
        audioSampleRate: f.audio_sample_rate,
        audioChannels: f.audio_channels,
      })
    }
  }

  // 轉換相關影片
  const recommendedVideos = convertRelatedVideos(relatedVideos)

  return {
    type: 'video',
    title: details.title || '',
    videoId: details.id,
    videoThumbnails: details.thumbnail || [],
    description: details.short_description || '',
    descriptionHtml: details.short_description || '',
    published: details.publish_date || '',
    publishedText: '',
    keywords: details.keywords || [],
    viewCount: details.view_count || 0,
    likeCount: info.basic_info.like_count || 0,
    dislikeCount: 0,
    paid: false,
    premium: false,
    isFamilyFriendly: true,
    allowedRegions: [],
    genre: details.category || '',
    author: details.author || '',
    authorId: details.channel_id || '',
    authorUrl: `/channel/${details.channel_id || ''}`,
    authorThumbnails: [],
    subCountText: '',
    lengthSeconds: details.duration || 0,
    allowRatings: true,
    rating: 0,
    isListed: true,
    liveNow: details.is_live || false,
    isUpcoming: details.is_upcoming || false,
    hlsUrl: streaming?.hls_manifest_url || null,
    dashUrl: streaming?.dash_manifest_url || null,
    adaptiveFormats: adaptiveFormats,
    formatStreams: formatStreams,
    captions: [],
    recommendedVideos: recommendedVideos,
  }
}

// 代理影片串流
function proxyVideo(req, res, targetUrl) {
  console.log(`  [PROXY] Streaming video...`)

  const parsedUrl = new URL(targetUrl)

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'com.google.android.youtube/19.02.39 (Linux; U; Android 14) gzip',
      'Accept-Encoding': 'identity', // 不壓縮，直接串流
    },
  }

  // 轉發 Range header (支援 seek)
  if (req.headers.range) {
    options.headers['Range'] = req.headers.range
    console.log(`  [PROXY] Range: ${req.headers.range}`)
  }

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`  [PROXY] Status: ${proxyRes.statusCode}`)

    // 設定回應 headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
      'Accept-Ranges': 'bytes',
    }

    if (proxyRes.headers['content-length']) {
      headers['Content-Length'] = proxyRes.headers['content-length']
    }
    if (proxyRes.headers['content-range']) {
      headers['Content-Range'] = proxyRes.headers['content-range']
    }

    res.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (e) => {
    console.error(`  [PROXY ERROR]`, e.message)
    if (!res.headersSent) {
      res.writeHead(502)
      res.end(JSON.stringify({ error: e.message }))
    }
  })

  proxyReq.setTimeout(30000, () => {
    console.error(`  [PROXY TIMEOUT]`)
    proxyReq.destroy()
  })

  proxyReq.end()
}

// HTTP 伺服器
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = req.url
  const path = url.split('?')[0]
  const query = parseQuery(url)

  console.log(`[API] ${req.method} ${path}`)

  try {
    // === Thumbnail 代理 (影片) ===
    const thumbMatch = path.match(/^\/vi\/([a-zA-Z0-9_-]+)\/(.+)$/)
    if (thumbMatch) {
      const videoId = thumbMatch[1]
      const filename = thumbMatch[2]
      const targetUrl = `https://i.ytimg.com/vi/${videoId}/${filename}`

      console.log(`  [THUMB] ${targetUrl}`)

      https.get(targetUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        })
        proxyRes.pipe(res)
      }).on('error', (e) => {
        res.writeHead(404)
        res.end('Not found')
      })
      return
    }

    // === Thumbnail 代理 (頻道頭像) ===
    if (path.startsWith('/ggpht/')) {
      const ggphtPath = path.replace('/ggpht', '')
      const targetUrl = `https://yt3.ggpht.com${ggphtPath}`

      console.log(`  [GGPHT] ${targetUrl}`)

      https.get(targetUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        })
        proxyRes.pipe(res)
      }).on('error', (e) => {
        res.writeHead(404)
        res.end('Not found')
      })
      return
    }

    // === 影片串流代理 ===
    if (path === '/videoplayback') {
      const encodedUrl = query.url
      if (!encodedUrl) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Missing url parameter' }))
        return
      }

      const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
      console.log(`  Target: ${targetUrl.substring(0, 80)}...`)

      proxyVideo(req, res, targetUrl)
      return
    }

    // === API 端點 ===
    res.setHeader('Content-Type', 'application/json')

    // 搜尋
    if (path === '/api/v1/search' || path === '/api/v1/search/') {
      const q = query.q || ''
      const results = await innertube.search(q)
      const converted = convertSearchResults(results.results || [])
      res.writeHead(200)
      res.end(JSON.stringify(converted))
      return
    }

    // 搜尋建議
    if (path === '/api/v1/search/suggestions' || path === '/api/v1/search/suggestions/') {
      const q = query.q || ''
      const suggestions = await innertube.getSearchSuggestions(q)
      res.writeHead(200)
      res.end(JSON.stringify({ query: q, suggestions: suggestions }))
      return
    }

    // 影片資訊
    const videoMatch = path.match(/^\/api\/v1\/videos\/([a-zA-Z0-9_-]+)/)
    if (videoMatch) {
      const videoId = videoMatch[1]
      console.log(`  Fetching video: ${videoId}`)
      // 用 Android client 取得影片，URL 不需要解密
      const info = await innertubeAndroid.getBasicInfo(videoId)

      // 用一般 client 取得相關影片 (Android client 沒有 watch_next_feed)
      let relatedVideos = []
      try {
        const fullInfo = await innertube.getInfo(videoId)
        relatedVideos = fullInfo.watch_next_feed || []
        console.log(`  Found ${relatedVideos.length} related videos`)
      } catch (e) {
        console.log(`  Could not get related videos: ${e.message}`)
      }

      const converted = await convertVideoInfo(info, relatedVideos)
      res.writeHead(200)
      res.end(JSON.stringify(converted))
      return
    }

    // 頻道資訊
    const channelMatch = path.match(/^\/api\/v1\/channels\/([a-zA-Z0-9_-]+)/)
    if (channelMatch) {
      const channelId = channelMatch[1]
      const channel = await innertube.getChannel(channelId)
      res.writeHead(200)
      res.end(JSON.stringify({
        author: channel.metadata?.title || '',
        authorId: channelId,
        authorBanners: channel.metadata?.banner || [],
        authorThumbnails: channel.metadata?.avatar || [],
        description: channel.metadata?.description || '',
        subCount: 0,
        totalViews: 0,
        joined: 0,
        latestVideos: [],
      }))
      return
    }

    // 熱門影片
    if (path === '/api/v1/trending' || path === '/api/v1/trending/') {
      const trending = await innertube.getTrending()
      const converted = convertSearchResults(trending.videos || [])
      res.writeHead(200)
      res.end(JSON.stringify(converted))
      return
    }

    // Stats (for health check)
    if (path === '/api/v1/stats' || path === '/api/v1/stats/') {
      res.writeHead(200)
      res.end(JSON.stringify({
        version: '1.0.0',
        software: { name: 'freetube-local-api', version: '1.0.0' },
        openRegistrations: false,
        usage: { users: { total: 1, activeHalfyear: 1, activeMonth: 1 } },
      }))
      return
    }

    // 404
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))

  } catch (error) {
    console.error('[ERROR]', error.message)
    res.writeHead(500)
    res.end(JSON.stringify({ error: error.message }))
  }
})

// 啟動
initInnertube().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('')
    console.log('='.repeat(50))
    console.log('  FreeTube Local API + Video Proxy')
    console.log('='.repeat(50))
    console.log('')
    console.log(`  API: http://localhost:${PORT}`)
    console.log(`  For phone: http://${HOST_IP}:${PORT}`)
    console.log('')
    console.log('  Endpoints:')
    console.log('    /api/v1/search?q=...')
    console.log('    /api/v1/videos/:id')
    console.log('    /api/v1/trending')
    console.log('    /videoplayback?url=...')
    console.log('')
    console.log('='.repeat(50))
    console.log('')
  })
}).catch(err => {
  console.error('Failed to initialize:', err)
})
