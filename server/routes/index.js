/**
 * FreeTube Local API Server - Routes
 * 路由聚合與分發
 */

const https = require('https')
const fs = require('fs')
const path = require('path')
const config = require('../config')

// === 快取設定 ===
const LYRICS_CACHE_DIR = config.cache.lyricsDir
const lyricsCache = new Map() // In-memory cache for fast access

// 確保快取目錄存在
if (!fs.existsSync(LYRICS_CACHE_DIR)) {
  fs.mkdirSync(LYRICS_CACHE_DIR, { recursive: true })
  console.log('[CACHE] Created lyrics cache directory:', LYRICS_CACHE_DIR)
}

// === 工具函數 ===

/**
 * 將原始 YouTube URL 轉換為 Proxy URL
 */
function toProxyUrl(originalUrl) {
  if (!originalUrl) return ''
  const encoded = Buffer.from(originalUrl).toString('base64url')
  return `/videoplayback?url=${encoded}`
}

/**
 * 轉義 XML 特殊字符
 */
function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 將 ggpht URL 轉換為 Proxy URL
 */
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

/**
 * 將影片縮圖 URL 轉換為 Proxy URL
 */
function toVideoThumbnailProxyUrl(url) {
  if (!url) return ''
  const match = url.match(/^https?:\/\/i\.ytimg\.com\/((vi|vi_webp)\/[^/]+\/.+)$/)
  if (match) {
    return `/${match[1]}`
  }
  return url
}

/**
 * 轉換 videoThumbnails 陣列中的 URL
 */
function convertVideoThumbnails(thumbnails) {
  if (!thumbnails || !Array.isArray(thumbnails)) return []
  return thumbnails.map(thumb => ({
    ...thumb,
    url: toVideoThumbnailProxyUrl(thumb.url)
  }))
}

/**
 * 建立標準化的 authorThumbnails 陣列
 */
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

/**
 * 解析時長字串
 */
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

/**
 * 轉換搜尋結果為 Invidious 格式
 */
function convertSearchResults(results) {
  return results.map(item => {
    if (item.type === 'Video') {
      const videoId = item.id
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
      const rawThumbs = item.author?.thumbnails || []
      let thumbUrl = rawThumbs[0]?.url || ''
      if (thumbUrl.startsWith('//')) {
        thumbUrl = 'https:' + thumbUrl
      }
      if (thumbUrl.includes('yt3.ggpht.com')) {
        const ggphtPath = thumbUrl.replace(/^https?:\/\/yt3\.ggpht\.com/, '')
        thumbUrl = `/ggpht${ggphtPath}`
      }
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

/**
 * 轉換相關影片為 Invidious 格式
 */
function convertRelatedVideos(relatedVideos) {
  if (!relatedVideos || !Array.isArray(relatedVideos)) return []

  return relatedVideos.map(item => {
    const skipTypes = ['Playlist', 'CompactPlaylist', 'Mix', 'CompactMix', 'Radio', 'CompactRadio', 'RichSection']
    if (skipTypes.includes(item.type)) {
      return null
    }

    let videoId, title, author, authorId, viewCountText, durationSeconds, publishedText

    if (item.type === 'LockupView') {
      if (item.content_type === 'PLAYLIST' || item.content_type === 'MIX') {
        return null
      }
      videoId = item.content_id
      if (!videoId) return null

      const meta = item.metadata
      title = meta?.title?.text || ''
      const metaView = meta?.metadata

      if (metaView?.metadata_rows && metaView.metadata_rows.length > 0) {
        const row0 = metaView.metadata_rows[0]
        const row1 = metaView.metadata_rows[1]
        author = row0?.metadata_parts?.[0]?.text?.content ||
                 row0?.metadata_parts?.[0]?.text?.text || ''
        authorId = row0?.metadata_parts?.[0]?.text?.command?.inner_endpoint?.browse_id || ''
        if (row1?.metadata_parts) {
          viewCountText = row1.metadata_parts[0]?.text?.content ||
                          row1.metadata_parts[0]?.text?.text || ''
          publishedText = row1.metadata_parts[1]?.text?.content ||
                          row1.metadata_parts[1]?.text?.text || ''
        }
      }

      if (!author && meta?.byline) {
        author = meta.byline.text || meta.byline || ''
      }
      if (!author && meta?.owner?.title) {
        author = meta.owner.title || ''
      }

      const decorations = item.content_image?.decorations || []
      for (const deco of decorations) {
        if (deco.type === 'ThumbnailOverlayBadgeView' && deco.text) {
          durationSeconds = parseDuration(deco.text)
          break
        }
        if (deco.type === 'ThumbnailOverlayTimeStatusView' && deco.text) {
          durationSeconds = parseDuration(deco.text)
          break
        }
      }
      durationSeconds = durationSeconds || 0

    } else if (item.type === 'CompactVideo' || item.type === 'Video') {
      videoId = item.id || item.video_id
      if (!videoId) return null
      title = item.title?.text || item.title || ''
      author = item.author?.name || item.author || ''
      authorId = item.author?.id || ''
      viewCountText = item.view_count?.text || item.short_view_count?.text || ''
      publishedText = item.published?.text || ''
      durationSeconds = item.duration?.seconds || 0
    } else {
      videoId = item.id || item.video_id || item.content_id
      if (!videoId) return null
      title = item.title?.text || item.title || ''
      author = item.author?.name || item.author || ''
      authorId = item.author?.id || ''
      viewCountText = ''
      publishedText = ''
      durationSeconds = 0
    }

    const videoThumbnails = [
      { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
      { quality: 'high', url: `/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
      { quality: 'medium', url: `/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
      { quality: 'default', url: `/vi/${videoId}/default.jpg`, width: 120, height: 90 },
    ]

    return {
      videoId: videoId,
      title: title,
      author: author || '未知頻道',
      authorId: authorId,
      authorUrl: `/channel/${authorId}`,
      authorThumbnails: [],
      videoThumbnails: videoThumbnails,
      viewCount: parseInt(viewCountText?.replace(/[^0-9]/g, '') || '0'),
      viewCountText: viewCountText || '',
      lengthSeconds: durationSeconds,
      published: publishedText,
      publishedText: publishedText || '',
    }
  }).filter(Boolean)
}

/**
 * 轉換頻道影片為 Invidious 格式
 */
function convertChannelVideos(videos, channelId) {
  return videos.map(video => {
    const videoId = video.id
    if (!videoId) return null

    const videoThumbnails = [
      { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
      { quality: 'high', url: `/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
      { quality: 'medium', url: `/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
      { quality: 'default', url: `/vi/${videoId}/default.jpg`, width: 120, height: 90 },
    ]

    let viewCount = 0
    const viewText = video.view_count?.text || video.short_view_count?.text || ''
    if (viewText) {
      const match = viewText.match(/([\d,.]+)\s*([KMB萬億次])?/i)
      if (match) {
        let num = parseFloat(match[1].replace(/,/g, ''))
        const unit = (match[2] || '').toUpperCase()
        if (unit === 'K' || unit === '萬') num *= 1000
        else if (unit === 'M' || unit === '億') num *= 1000000
        else if (unit === 'B') num *= 1000000000
        viewCount = Math.floor(num)
      }
    }

    return {
      type: 'video',
      title: video.title?.text || '',
      videoId: videoId,
      author: video.author?.name || '',
      authorId: channelId,
      authorUrl: `/channel/${channelId}`,
      videoThumbnails: videoThumbnails,
      description: '',
      viewCount: viewCount,
      viewCountText: viewText,
      published: 0,
      publishedText: video.published?.text || '',
      lengthSeconds: video.duration?.seconds || 0,
      liveNow: video.is_live || false,
      isUpcoming: video.is_upcoming || false,
    }
  }).filter(Boolean)
}

/**
 * 轉換影片資訊為 Invidious 格式
 */
async function convertVideoInfo(info, relatedVideos, channelAvatar = null) {
  const details = info.basic_info
  const streaming = info.streaming_data
  const playabilityStatus = info.playability_status

  const authorThumbnails = channelAvatar ? createAuthorThumbnails(channelAvatar) : []

  let errorMessage = null
  if (playabilityStatus?.status === 'LOGIN_REQUIRED') {
    errorMessage = '此影片需要登入才能觀看'
  } else if (playabilityStatus?.status === 'UNPLAYABLE') {
    errorMessage = playabilityStatus.reason || '此影片無法播放'
  } else if (playabilityStatus?.status === 'ERROR') {
    errorMessage = playabilityStatus.reason || '影片載入錯誤'
  }

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
        init: f.init_range ? `${f.init_range.start}-${f.init_range.end}` : '0-0',
        index: f.index_range ? `${f.index_range.start}-${f.index_range.end}` : '0-0',
        clen: f.content_length || 0,
        lmt: f.last_modified || '',
      })
    }
  }

  const recommendedVideos = convertRelatedVideos(relatedVideos)

  return {
    type: 'video',
    title: details.title || '',
    videoId: details.id,
    videoThumbnails: convertVideoThumbnails(details.thumbnail || []),
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
    authorThumbnails: authorThumbnails,
    subCountText: '',
    lengthSeconds: details.duration || 0,
    allowRatings: true,
    rating: 0,
    isListed: true,
    liveNow: details.is_live || false,
    isUpcoming: details.is_upcoming || false,
    hlsUrl: streaming?.hls_manifest_url || null,
    dashUrl: `/api/manifest/dash/id/${details.id}`,
    adaptiveFormats: adaptiveFormats,
    formatStreams: formatStreams,
    captions: [],
    recommendedVideos: recommendedVideos,
    playabilityStatus: playabilityStatus?.status || 'OK',
    errorMessage: errorMessage,
  }
}

/**
 * 生成 DASH manifest XML
 */
function generateDashManifest(videoId, adaptiveFormats, duration) {
  const durationSeconds = duration || 0
  const durationISO = `PT${Math.floor(durationSeconds / 3600)}H${Math.floor((durationSeconds % 3600) / 60)}M${durationSeconds % 60}S`

  const videoFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('video/'))
  const audioFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('audio/'))

  let adaptationSets = ''

  if (videoFormats.length > 0) {
    let representations = ''
    for (const format of videoFormats) {
      const url = toProxyUrl(format.url)
      const codecs = format.mime_type?.match(/codecs="([^"]+)"/)?.[1] || ''

      representations += `
        <Representation id="${format.itag}" bandwidth="${format.bitrate || 0}" width="${format.width || 0}" height="${format.height || 0}" codecs="${codecs}">
          <BaseURL>${escapeXml(url)}</BaseURL>
          <SegmentBase indexRange="${format.index_range?.start || 0}-${format.index_range?.end || 0}">
            <Initialization range="${format.init_range?.start || 0}-${format.init_range?.end || 0}"/>
          </SegmentBase>
        </Representation>`
    }

    adaptationSets += `
    <AdaptationSet mimeType="video/mp4" subsegmentAlignment="true">
      ${representations}
    </AdaptationSet>`
  }

  if (audioFormats.length > 0) {
    let representations = ''
    for (const format of audioFormats) {
      const url = toProxyUrl(format.url)
      const codecs = format.mime_type?.match(/codecs="([^"]+)"/)?.[1] || ''

      representations += `
        <Representation id="${format.itag}" bandwidth="${format.bitrate || 0}" codecs="${codecs}">
          <BaseURL>${escapeXml(url)}</BaseURL>
          <SegmentBase indexRange="${format.index_range?.start || 0}-${format.index_range?.end || 0}">
            <Initialization range="${format.init_range?.start || 0}-${format.init_range?.end || 0}"/>
          </SegmentBase>
        </Representation>`
    }

    adaptationSets += `
    <AdaptationSet mimeType="audio/mp4" subsegmentAlignment="true">
      ${representations}
    </AdaptationSet>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" mediaPresentationDuration="${durationISO}" minBufferTime="PT1.5S">
  <Period duration="${durationISO}">
    ${adaptationSets}
  </Period>
</MPD>`
}

// === Lyrics Cache 函數 ===

function generateLyricsCacheKey(track, artist) {
  const normalized = `${track.toLowerCase().trim()}_${artist.toLowerCase().trim()}`
  const hash = Buffer.from(normalized).toString('base64url').substring(0, 32)
  return hash
}

function getLyricsCacheFilePath(key) {
  return path.join(LYRICS_CACHE_DIR, `${key}.json`)
}

function loadLyricsFromCache(track, artist) {
  const key = generateLyricsCacheKey(track, artist)
  if (lyricsCache.has(key)) {
    console.log('[CACHE] Lyrics found in memory:', track, 'by', artist)
    return lyricsCache.get(key)
  }
  const filePath = getLyricsCacheFilePath(key)
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      lyricsCache.set(key, data)
      console.log('[CACHE] Lyrics loaded from file:', track, 'by', artist)
      return data
    } catch (e) {
      console.error('[CACHE] Error reading cache file:', e.message)
    }
  }
  return null
}

function saveLyricsToCache(track, artist, lyricsData) {
  const key = generateLyricsCacheKey(track, artist)
  lyricsCache.set(key, lyricsData)
  const filePath = getLyricsCacheFilePath(key)
  try {
    fs.writeFileSync(filePath, JSON.stringify(lyricsData, null, 2))
    console.log('[CACHE] Lyrics saved:', track, 'by', artist)
  } catch (e) {
    console.error('[CACHE] Error saving cache file:', e.message)
  }
}

function loadLyricsCacheFromDisk() {
  try {
    const files = fs.readdirSync(LYRICS_CACHE_DIR)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const key = file.replace('.json', '')
        const filePath = path.join(LYRICS_CACHE_DIR, file)
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          lyricsCache.set(key, data)
        } catch (e) {
          // Skip corrupted files
        }
      }
    }
    console.log(`[CACHE] Loaded ${lyricsCache.size} cached lyrics from disk`)
  } catch (e) {
    console.error('[CACHE] Error loading cache:', e.message)
  }
}

// 啟動時載入快取
loadLyricsCacheFromDisk()

// === 代理影片串流 ===

function proxyVideo(req, res, targetUrl) {
  console.log(`  [PROXY] Streaming video...`)

  const parsedUrl = new URL(targetUrl)
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': config.proxy.userAgent,
      'Accept-Encoding': 'identity',
    },
  }

  if (req.headers.range) {
    options.headers['Range'] = req.headers.range
    console.log(`  [PROXY] Range: ${req.headers.range}`)
  }

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`  [PROXY] Status: ${proxyRes.statusCode}`)

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

  proxyReq.setTimeout(config.proxy.timeout, () => {
    console.error(`  [PROXY TIMEOUT]`)
    proxyReq.destroy()
  })

  proxyReq.end()
}

// === 頻道子資源處理 ===

async function handleChannelSubResource(res, channel, channelId, subResource, query, innertube) {
  try {
    let data = { videos: [], continuation: null }

    switch (subResource) {
      case 'videos': {
        const videosTab = await channel.getVideos()
        const videos = convertChannelVideos(videosTab.videos || [], channelId)
        data = { videos, continuation: videosTab.has_continuation ? 'has_more' : null }
        break
      }

      case 'shorts': {
        if (channel.has_shorts) {
          const shortsTab = await channel.getShorts()
          const videos = (shortsTab.videos || []).map(video => {
            const videoId = video.id
            if (!videoId) return null
            return {
              type: 'video',
              title: video.title?.text || '',
              videoId,
              author: '',
              authorId: channelId,
              authorUrl: `/channel/${channelId}`,
              videoThumbnails: [{ quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 }],
              viewCount: 0,
              viewCountText: video.views?.text || '',
              lengthSeconds: 60,
              liveNow: false,
            }
          }).filter(Boolean)
          data = { videos, continuation: shortsTab.has_continuation ? 'has_more' : null }
        }
        break
      }

      case 'playlists': {
        if (channel.has_playlists) {
          const playlistsTab = await channel.getPlaylists()
          const playlists = (playlistsTab.playlists || []).map(playlist => ({
            type: 'playlist',
            title: playlist.title?.text || '',
            playlistId: playlist.id,
            playlistThumbnail: `/vi/${playlist.first_video_id}/mqdefault.jpg`,
            author: channel.metadata?.title || '',
            authorId: channelId,
            videoCount: playlist.video_count || 0,
          }))
          data = { playlists, continuation: playlistsTab.has_continuation ? 'has_more' : null }
        }
        break
      }

      case 'community':
      case 'posts': {
        if (channel.has_community) {
          const communityTab = await channel.getCommunity()
          const channelName = channel.metadata?.title || ''
          const channelAvatar = channel.metadata?.avatar?.[0]?.url || ''
          const posts = (communityTab.posts || []).map(post => ({
            author: channelName,
            authorId: channelId,
            authorThumbnails: createAuthorThumbnails(channelAvatar),
            authorUrl: `/channel/${channelId}`,
            commentId: post.id || '',
            content: post.content?.text || '',
            contentHtml: post.content?.text || '',
            likeCount: 0,
            publishedText: post.published?.text || '',
            replyCount: 0,
            attachment: null,
          }))
          data = { comments: posts, continuation: communityTab.has_continuation ? 'has_more' : null }
        }
        break
      }

      case 'live':
      case 'streams': {
        if (channel.has_live_streams) {
          const liveTab = await channel.getLiveStreams()
          const videos = convertChannelVideos(liveTab.videos || [], channelId)
          data = { videos, continuation: liveTab.has_continuation ? 'has_more' : null }
        }
        break
      }

      default:
        res.writeHead(404)
        res.end(JSON.stringify({ error: `Unknown sub-resource: ${subResource}` }))
        return
    }

    res.writeHead(200)
    res.end(JSON.stringify(data))
  } catch (e) {
    console.error(`  Sub-resource error: ${e.message}`)
    res.writeHead(500)
    res.end(JSON.stringify({ error: e.message }))
  }
}

// === 主要路由處理 ===

/**
 * 處理請求
 * @param {Object} context - 請求上下文
 * @returns {boolean} 是否已處理請求
 */
async function handleRequest(context) {
  const { req, res, path, query, innertube, innertubeAndroid } = context

  // === Thumbnail 代理 (影片) ===
  const thumbMatch = path.match(/^\/(vi|vi_webp)\/([a-zA-Z0-9_-]+)\/(.+)$/)
  if (thumbMatch) {
    const viPath = thumbMatch[1]
    const videoId = thumbMatch[2]
    const filename = thumbMatch[3]
    const targetUrl = `https://i.ytimg.com/${viPath}/${videoId}/${filename}`

    console.log(`  [THUMB] ${targetUrl}`)

    https.get(targetUrl, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
        'Cache-Control': `public, max-age=${config.cacheTTL.thumbnail}`,
        'Access-Control-Allow-Origin': '*',
      })
      proxyRes.pipe(res)
    }).on('error', () => {
      res.writeHead(404)
      res.end('Not found')
    })
    return true
  }

  // === Thumbnail 代理 (頻道頭像) ===
  if (path.startsWith('/ggpht/')) {
    const ggphtPath = path.replace('/ggpht', '')

    const tryGoogleusercontent = () => {
      const googleUrl = `https://yt3.googleusercontent.com${ggphtPath}`
      console.log(`  [GGPHT] Trying googleusercontent: ${googleUrl}`)

      https.get(googleUrl, (proxyRes) => {
        if (proxyRes.statusCode === 200) {
          res.writeHead(200, {
            'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
            'Cache-Control': `public, max-age=${config.cacheTTL.thumbnail}`,
            'Access-Control-Allow-Origin': '*',
          })
          proxyRes.pipe(res)
        } else {
          proxyRes.resume()
          tryGgpht()
        }
      }).on('error', () => tryGgpht())
    }

    const tryGgpht = () => {
      const ggphtUrl = `https://yt3.ggpht.com${ggphtPath}`
      console.log(`  [GGPHT] Trying ggpht: ${ggphtUrl}`)

      https.get(ggphtUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': `public, max-age=${config.cacheTTL.thumbnail}`,
          'Access-Control-Allow-Origin': '*',
        })
        proxyRes.pipe(res)
      }).on('error', () => {
        res.writeHead(404)
        res.end('Not found')
      })
    }

    tryGoogleusercontent()
    return true
  }

  // === 通用圖片代理 ===
  if (path === '/imgproxy') {
    const encodedUrl = query.url
    if (!encodedUrl) {
      res.writeHead(400)
      res.end('Missing url parameter')
      return true
    }

    const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
    console.log(`  [IMGPROXY] ${targetUrl}`)

    https.get(targetUrl, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
        'Cache-Control': `public, max-age=${config.cacheTTL.thumbnail}`,
        'Access-Control-Allow-Origin': '*',
      })
      proxyRes.pipe(res)
    }).on('error', () => {
      res.writeHead(404)
      res.end('Not found')
    })
    return true
  }

  // === DASH Manifest 代理 ===
  if (path === '/manifest') {
    const encodedUrl = query.url
    if (!encodedUrl) {
      res.writeHead(400)
      res.end('Missing url parameter')
      return true
    }

    const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
    console.log(`  [MANIFEST] ${targetUrl.substring(0, 80)}...`)

    https.get(targetUrl, (proxyRes) => {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        const modifiedData = data.replace(
          /<BaseURL>([^<]+)<\/BaseURL>/g,
          (match, url) => {
            const encoded = Buffer.from(url).toString('base64url')
            return `<BaseURL>/videoplayback?url=${encoded}</BaseURL>`
          }
        )

        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/dash+xml',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(modifiedData)
      })
    }).on('error', (e) => {
      console.error(`  [MANIFEST ERROR]`, e.message)
      res.writeHead(502)
      res.end('Manifest fetch failed')
    })
    return true
  }

  // === 影片串流代理 ===
  if (path === '/videoplayback') {
    const encodedUrl = query.url
    if (!encodedUrl) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'Missing url parameter' }))
      return true
    }

    const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
    console.log(`  Target: ${targetUrl.substring(0, 80)}...`)

    proxyVideo(req, res, targetUrl)
    return true
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
    return true
  }

  // 搜尋建議
  if (path === '/api/v1/search/suggestions' || path === '/api/v1/search/suggestions/') {
    const q = query.q || ''
    const suggestions = await innertube.getSearchSuggestions(q)
    res.writeHead(200)
    res.end(JSON.stringify({ query: q, suggestions }))
    return true
  }

  // DASH Manifest 端點
  const dashManifestMatch = path.match(/^\/api\/manifest\/dash\/id\/([a-zA-Z0-9_-]+)/)
  if (dashManifestMatch) {
    const videoId = dashManifestMatch[1]
    console.log(`  [DASH] Generating manifest for: ${videoId}`)

    try {
      const info = await innertubeAndroid.getBasicInfo(videoId)
      const streaming = info.streaming_data

      if (!streaming || !streaming.adaptive_formats) {
        res.writeHead(404)
        res.end('No streaming data')
        return true
      }

      const adaptiveFormats = streaming.adaptive_formats || []
      const manifest = generateDashManifest(videoId, adaptiveFormats, info.basic_info?.duration || 0)

      res.writeHead(200, {
        'Content-Type': 'application/dash+xml',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(manifest)
    } catch (e) {
      console.error(`  [DASH ERROR] ${e.message}`)
      res.writeHead(500)
      res.end('Error generating manifest')
    }
    return true
  }

  // 影片資訊
  const videoMatch = path.match(/^\/api\/v1\/videos\/([a-zA-Z0-9_-]+)/)
  if (videoMatch) {
    const videoId = videoMatch[1]
    console.log(`  Fetching video: ${videoId}`)

    const info = await innertubeAndroid.getBasicInfo(videoId)

    let relatedVideos = []
    let channelAvatar = null
    let channelId = null

    try {
      const fullInfo = await innertube.getInfo(videoId)
      relatedVideos = fullInfo.watch_next_feed || []
      console.log(`  Found ${relatedVideos.length} related videos`)

      channelId = fullInfo.basic_info?.channel_id || fullInfo.secondary_info?.owner?.author?.id

      const secondaryInfo = fullInfo.secondary_info
      if (secondaryInfo?.owner?.author?.thumbnails?.[0]?.url) {
        channelAvatar = secondaryInfo.owner.author.thumbnails[0].url
        console.log(`  Found channel avatar`)
      }
    } catch (e) {
      console.log(`  Could not get related videos: ${e.message}`)
    }

    // 混合推薦策略
    let channelVideos = []
    if (channelId) {
      try {
        const channel = await innertube.getChannel(channelId)
        const videosTab = await channel.getVideos()
        const allChannelVideos = videosTab.videos || []
        channelVideos = allChannelVideos.filter(v => v.id !== videoId).slice(0, 5)
        if (channelVideos.length > 0) {
          console.log(`  Added ${channelVideos.length} channel videos to recommendations`)
        }
      } catch (e) {
        // 忽略錯誤
      }
    }

    const seenIds = new Set()
    const mergedRelated = []

    for (const video of channelVideos) {
      if (!seenIds.has(video.id)) {
        seenIds.add(video.id)
        mergedRelated.push(video)
      }
    }

    for (const video of relatedVideos) {
      const vid = video.id || video.video_id || video.content_id
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid)
        mergedRelated.push(video)
      }
    }

    console.log(`  Mixed recommendations: ${channelVideos.length} channel + ${relatedVideos.length} related = ${mergedRelated.length} total`)

    const converted = await convertVideoInfo(info, mergedRelated, channelAvatar)
    res.writeHead(200)
    res.end(JSON.stringify(converted))
    return true
  }

  // 頻道資訊
  const channelMatch = path.match(/^\/api\/v1\/channels\/([a-zA-Z0-9_-]+)(\/([a-z]+))?/)
  if (channelMatch) {
    const channelId = channelMatch[1]
    const subResource = channelMatch[3]

    console.log(`  Fetching channel: ${channelId}, subResource: ${subResource || 'info'}`)

    try {
      const channel = await innertube.getChannel(channelId)

      if (subResource) {
        await handleChannelSubResource(res, channel, channelId, subResource, query, innertube)
        return true
      }

      const metadata = channel.metadata || {}

      const tabs = []
      if (channel.has_videos) tabs.push('videos')
      if (channel.has_shorts) tabs.push('shorts')
      if (channel.has_live_streams) tabs.push('live')
      if (channel.has_playlists) tabs.push('playlists')
      if (channel.has_community) tabs.push('community')
      tabs.push('about')

      const avatarUrl = metadata.avatar?.[0]?.url || ''
      const authorThumbnails = createAuthorThumbnails(avatarUrl)

      const bannerUrl = metadata.banner?.[0]?.url || ''
      const authorBanners = bannerUrl ? [{ url: toGgphtProxyUrl(bannerUrl), width: 1280, height: 720 }] : []

      let subCount = 0
      const subText = metadata.subscriber_count || ''
      if (subText) {
        const match = subText.match(/([\d.]+)\s*([KMB萬億])?/i)
        if (match) {
          let num = parseFloat(match[1])
          const unit = (match[2] || '').toUpperCase()
          if (unit === 'K' || unit === '萬') num *= 1000
          else if (unit === 'M' || unit === '億') num *= 1000000
          else if (unit === 'B') num *= 1000000000
          subCount = Math.floor(num)
        }
      }

      let latestVideos = []
      try {
        if (channel.has_videos) {
          const videosTab = await channel.getVideos()
          latestVideos = convertChannelVideos(videosTab.videos || [], channelId)
        }
      } catch (e) {
        console.log(`  Could not fetch latest videos: ${e.message}`)
      }

      res.writeHead(200)
      res.end(JSON.stringify({
        author: metadata.title || '',
        authorId: channelId,
        authorUrl: `/channel/${channelId}`,
        authorVerified: false,
        authorBanners,
        authorThumbnails,
        subCount,
        totalViews: 0,
        joined: 0,
        autoGenerated: false,
        isFamilyFriendly: metadata.is_family_safe ?? true,
        description: metadata.description || '',
        descriptionHtml: metadata.description || '',
        allowedRegions: [],
        tabs,
        latestVideos,
        relatedChannels: [],
      }))
      return true
    } catch (e) {
      console.error(`  Channel error: ${e.message}`)
      res.writeHead(500)
      res.end(JSON.stringify({ error: e.message }))
      return true
    }
  }

  // 熱門影片
  if (path === '/api/v1/trending' || path === '/api/v1/trending/' ||
      path === '/api/v1/popular' || path === '/api/v1/popular/') {
    try {
      const trending = await innertube.getTrending()
      const converted = convertSearchResults(trending.videos || [])
      res.writeHead(200)
      res.end(JSON.stringify(converted))
    } catch (trendingError) {
      console.log('  [TRENDING] getTrending failed, using search fallback')
      try {
        const searchResults = await innertube.search('music video 2024', { sort_by: 'view_count' })
        const converted = convertSearchResults(searchResults.results || [])
        res.writeHead(200)
        res.end(JSON.stringify(converted))
      } catch (searchError) {
        console.error('  [TRENDING] Search fallback also failed:', searchError.message)
        res.writeHead(500)
        res.end(JSON.stringify({ error: 'Unable to fetch trending videos' }))
      }
    }
    return true
  }

  // === Lyrics Cache API ===
  if (path === '/api/v1/lyrics/cache' && req.method === 'GET') {
    const track = query.track || ''
    const artist = query.artist || ''

    if (!track) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'Missing track parameter' }))
      return true
    }

    const cached = loadLyricsFromCache(track, artist)
    if (cached) {
      console.log(`  [LYRICS] Cache HIT: ${track} by ${artist}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ found: true, data: cached }))
    } else {
      console.log(`  [LYRICS] Cache MISS: ${track} by ${artist}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ found: false }))
    }
    return true
  }

  if (path === '/api/v1/lyrics/cache' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const { track, artist, lyricsData } = JSON.parse(body)
        if (!track || !lyricsData) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Missing track or lyricsData' }))
          return
        }
        saveLyricsToCache(track, artist || '', lyricsData)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (e) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return true
  }

  // Lyrics fetch
  if (path === '/api/v1/lyrics/fetch' || path === '/api/v1/lyrics/fetch/') {
    const track = query.track || ''
    const artist = query.artist || ''
    const duration = query.duration || '0'

    if (!track) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'Missing track parameter' }))
      return true
    }

    const cached = loadLyricsFromCache(track, artist)
    if (cached) {
      console.log(`  [LYRICS] Serving from cache: ${track} by ${artist}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(cached))
      return true
    }

    console.log(`  [LYRICS] Fetching from LRCLIB: ${track} by ${artist}`)

    const params = new URLSearchParams({ track_name: track, artist_name: artist })
    if (duration && duration !== '0') {
      params.append('duration', duration)
    }

    const targetUrl = `https://lrclib.net/api/get?${params}`

    https.get(targetUrl, (proxyRes) => {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        if (proxyRes.statusCode === 200) {
          try {
            const lyricsData = JSON.parse(data)
            saveLyricsToCache(track, artist, lyricsData)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(data)
          } catch (e) {
            res.writeHead(500)
            res.end(JSON.stringify({ error: 'Invalid response from LRCLIB' }))
          }
        } else if (proxyRes.statusCode === 404) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Lyrics not found' }))
        } else {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' })
          res.end(data)
        }
      })
    }).on('error', (e) => {
      console.error(`  [LYRICS] LRCLIB error: ${e.message}`)
      res.writeHead(502)
      res.end(JSON.stringify({ error: e.message }))
    })
    return true
  }

  // Lyrics search
  if (path === '/api/v1/lyrics/search' || path === '/api/v1/lyrics/search/') {
    const q = query.q || ''

    if (!q) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'Missing q parameter' }))
      return true
    }

    console.log(`  [LYRICS] Searching LRCLIB: ${q}`)

    const targetUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`

    https.get(targetUrl, (proxyRes) => {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(data)
      })
    }).on('error', (e) => {
      console.error(`  [LYRICS] Search error: ${e.message}`)
      res.writeHead(502)
      res.end(JSON.stringify({ error: e.message }))
    })
    return true
  }

  // Lyrics stats
  if (path === '/api/v1/lyrics/stats' || path === '/api/v1/lyrics/stats/') {
    let fileCount = 0
    try {
      fileCount = fs.readdirSync(LYRICS_CACHE_DIR).filter(f => f.endsWith('.json')).length
    } catch (e) {
      // Ignore
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      cacheDir: LYRICS_CACHE_DIR,
      memoryCacheSize: lyricsCache.size,
      diskCacheSize: fileCount,
    }))
    return true
  }

  // Stats (health check)
  if (path === '/api/v1/stats' || path === '/api/v1/stats/') {
    res.writeHead(200)
    res.end(JSON.stringify({
      version: '1.0.0',
      software: { name: 'freetube-local-api', version: '1.0.0' },
      openRegistrations: false,
      usage: { users: { total: 1, activeHalfyear: 1, activeMonth: 1 } },
    }))
    return true
  }

  // 未匹配任何路由
  return false
}

module.exports = {
  handleRequest,
  // 匯出工具函數供其他模組使用
  toProxyUrl,
  toGgphtProxyUrl,
  toVideoThumbnailProxyUrl,
  convertSearchResults,
  convertRelatedVideos,
  convertChannelVideos,
  convertVideoInfo,
  createAuthorThumbnails,
  generateDashManifest,
  parseDuration,
  escapeXml,
}
