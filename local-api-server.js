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

// 將 DASH manifest URL 轉換為 Proxy URL
function toManifestProxyUrl(manifestUrl) {
  if (!manifestUrl) return ''
  const encoded = Buffer.from(manifestUrl).toString('base64url')
  return `http://${HOST_IP}:${PORT}/manifest?url=${encoded}`
}

// 生成 DASH manifest XML
function generateDashManifest(videoId, adaptiveFormats, duration) {
  const durationSeconds = duration || 0
  const durationISO = `PT${Math.floor(durationSeconds / 3600)}H${Math.floor((durationSeconds % 3600) / 60)}M${durationSeconds % 60}S`

  // 分離音頻和視頻格式
  const videoFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('video/'))
  const audioFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('audio/'))

  let adaptationSets = ''

  // 視頻 AdaptationSet
  if (videoFormats.length > 0) {
    let representations = ''
    for (const format of videoFormats) {
      const url = toProxyUrl(format.url)
      const mimeType = format.mime_type?.split(';')[0] || 'video/mp4'
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

  // 音頻 AdaptationSet
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

// 轉義 XML 特殊字符
function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 將 ggpht URL 轉換為 Proxy URL (頻道頭像/Banner)
function toGgphtProxyUrl(url) {
  if (!url) return ''
  // 處理 protocol-relative URL
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  // 轉換 ggpht URL - 返回完整 URL
  if (url.includes('yt3.ggpht.com')) {
    const ggphtPath = url.replace(/^https?:\/\/yt3\.ggpht\.com/, '')
    return `http://${HOST_IP}:${PORT}/ggpht${ggphtPath}`
  }
  // 轉換 googleusercontent URL (有些頭像用這個) - 返回完整 URL
  if (url.includes('googleusercontent.com')) {
    const encoded = Buffer.from(url).toString('base64url')
    return `http://${HOST_IP}:${PORT}/imgproxy?url=${encoded}`
  }
  return url
}

// 建立標準化的 authorThumbnails 陣列
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
    // 過濾掉播放列表、混合內容等非影片類型
    const skipTypes = ['Playlist', 'CompactPlaylist', 'Mix', 'CompactMix', 'Radio', 'CompactRadio', 'RichSection']
    if (skipTypes.includes(item.type)) {
      return null
    }

    // 支援多種格式
    let videoId, title, author, authorId, viewCountText, durationSeconds, publishedText

    if (item.type === 'LockupView') {
      // 檢查是否為播放列表
      if (item.content_type === 'PLAYLIST' || item.content_type === 'MIX') {
        return null
      }
      // 新版 YouTube 格式 (2024+)
      videoId = item.content_id
      if (!videoId) return null

      // 從 metadata 提取資訊
      const meta = item.metadata
      title = meta?.title?.text || ''

      // 嘗試多種路徑提取 metadata
      const metaView = meta?.metadata

      // 方法1: metadata_rows
      if (metaView?.metadata_rows && metaView.metadata_rows.length > 0) {
        const row0 = metaView.metadata_rows[0]
        const row1 = metaView.metadata_rows[1]

        // 頻道名稱
        author = row0?.metadata_parts?.[0]?.text?.content ||
                 row0?.metadata_parts?.[0]?.text?.text || ''
        authorId = row0?.metadata_parts?.[0]?.text?.command?.inner_endpoint?.browse_id || ''

        // 觀看數和發布時間 (通常在第二行)
        if (row1?.metadata_parts) {
          viewCountText = row1.metadata_parts[0]?.text?.content ||
                          row1.metadata_parts[0]?.text?.text || ''
          publishedText = row1.metadata_parts[1]?.text?.content ||
                          row1.metadata_parts[1]?.text?.text || ''
        }
      }

      // 方法2: 從 byline 提取
      if (!author && meta?.byline) {
        author = meta.byline.text || meta.byline || ''
      }

      // 方法3: 從 owner 提取
      if (!author && meta?.owner?.title) {
        author = meta.owner.title || ''
      }

      // 從 content_image 提取時長
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

    // 使用完整 URL (避免前端解析到錯誤的 host)
    const videoThumbnails = [
      { quality: 'maxres', url: `http://${HOST_IP}:${PORT}/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
      { quality: 'high', url: `http://${HOST_IP}:${PORT}/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
      { quality: 'medium', url: `http://${HOST_IP}:${PORT}/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
      { quality: 'default', url: `http://${HOST_IP}:${PORT}/vi/${videoId}/default.jpg`, width: 120, height: 90 },
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

// 轉換頻道影片為 Invidious 格式
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

    // 解析觀看數
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

// 處理頻道子資源 (videos, shorts, playlists, community)
async function handleChannelSubResource(res, channel, channelId, subResource, query) {
  const sortBy = query.sort_by || 'newest'
  const continuation = query.continuation || null

  try {
    let data = { videos: [], continuation: null }

    switch (subResource) {
      case 'videos': {
        const videosTab = await channel.getVideos()
        const videos = convertChannelVideos(videosTab.videos || [], channelId)
        data = {
          videos: videos,
          continuation: videosTab.has_continuation ? 'has_more' : null
        }
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
              videoId: videoId,
              author: '',
              authorId: channelId,
              authorUrl: `/channel/${channelId}`,
              videoThumbnails: [
                { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
              ],
              viewCount: 0,
              viewCountText: video.views?.text || '',
              lengthSeconds: 60, // Shorts 通常很短
              liveNow: false,
            }
          }).filter(Boolean)
          data = {
            videos: videos,
            continuation: shortsTab.has_continuation ? 'has_more' : null
          }
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
          data = {
            playlists: playlists,
            continuation: playlistsTab.has_continuation ? 'has_more' : null
          }
        }
        break
      }

      case 'community':
      case 'posts': {
        if (channel.has_community) {
          const communityTab = await channel.getCommunity()
          const channelName = channel.metadata?.title || ''
          const channelAvatar = channel.metadata?.avatar?.[0]?.url || ''

          const posts = (communityTab.posts || []).map(post => {
            // 轉換為 Invidious 格式
            return {
              author: channelName,
              authorId: channelId,
              authorThumbnails: createAuthorThumbnails(channelAvatar),
              authorUrl: `/channel/${channelId}`,
              commentId: post.id || '',
              content: post.content?.text || '',
              contentHtml: post.content?.text || '', // Invidious 需要這個欄位
              likeCount: 0,
              publishedText: post.published?.text || '',
              replyCount: 0,
              attachment: null,
            }
          })
          data = {
            comments: posts,
            continuation: communityTab.has_continuation ? 'has_more' : null
          }
        }
        break
      }

      case 'live':
      case 'streams': {
        if (channel.has_live_streams) {
          const liveTab = await channel.getLiveStreams()
          const videos = convertChannelVideos(liveTab.videos || [], channelId)
          data = {
            videos: videos,
            continuation: liveTab.has_continuation ? 'has_more' : null
          }
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

// 轉換影片資訊為 Invidious 格式 (含 Proxy URL)
async function convertVideoInfo(info, relatedVideos, channelAvatar = null) {
  const details = info.basic_info
  const streaming = info.streaming_data
  const playabilityStatus = info.playability_status

  // 建立頻道頭像 (如果有傳入)
  const authorThumbnails = channelAvatar ? createAuthorThumbnails(channelAvatar) : []

  // 檢查播放狀態
  let errorMessage = null
  if (playabilityStatus?.status === 'LOGIN_REQUIRED') {
    errorMessage = '此影片需要登入才能觀看'
  } else if (playabilityStatus?.status === 'UNPLAYABLE') {
    errorMessage = playabilityStatus.reason || '此影片無法播放'
  } else if (playabilityStatus?.status === 'ERROR') {
    errorMessage = playabilityStatus.reason || '影片載入錯誤'
  }

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
    authorThumbnails: authorThumbnails,
    subCountText: '',
    lengthSeconds: details.duration || 0,
    allowRatings: true,
    rating: 0,
    isListed: true,
    liveNow: details.is_live || false,
    isUpcoming: details.is_upcoming || false,
    hlsUrl: streaming?.hls_manifest_url || null,
    dashUrl: streaming?.dash_manifest_url ? toManifestProxyUrl(streaming.dash_manifest_url) : null,
    adaptiveFormats: adaptiveFormats,
    formatStreams: formatStreams,
    captions: [],
    recommendedVideos: recommendedVideos,
    // 播放狀態
    playabilityStatus: playabilityStatus?.status || 'OK',
    errorMessage: errorMessage,
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
    const thumbMatch = path.match(/^\/(vi|vi_webp)\/([a-zA-Z0-9_-]+)\/(.+)$/)
    if (thumbMatch) {
      const viPath = thumbMatch[1]  // vi or vi_webp
      const videoId = thumbMatch[2]
      const filename = thumbMatch[3]
      const targetUrl = `https://i.ytimg.com/${viPath}/${videoId}/${filename}`

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
    // 支援 yt3.ggpht.com 和 yt3.googleusercontent.com 兩種來源
    if (path.startsWith('/ggpht/')) {
      const ggphtPath = path.replace('/ggpht', '')

      // 先嘗試 googleusercontent.com (較新的 CDN)
      const tryGoogleusercontent = () => {
        const googleUrl = `https://yt3.googleusercontent.com${ggphtPath}`
        console.log(`  [GGPHT] Trying googleusercontent: ${googleUrl}`)

        https.get(googleUrl, (proxyRes) => {
          if (proxyRes.statusCode === 200) {
            res.writeHead(200, {
              'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
            })
            proxyRes.pipe(res)
          } else {
            // googleusercontent 也失敗，嘗試 ggpht.com
            proxyRes.resume() // drain the response
            tryGgpht()
          }
        }).on('error', () => {
          tryGgpht()
        })
      }

      // 嘗試 ggpht.com (原始 CDN)
      const tryGgpht = () => {
        const ggphtUrl = `https://yt3.ggpht.com${ggphtPath}`
        console.log(`  [GGPHT] Trying ggpht: ${ggphtUrl}`)

        https.get(ggphtUrl, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          })
          proxyRes.pipe(res)
        }).on('error', (e) => {
          console.error(`  [GGPHT] Both CDNs failed for ${ggphtPath}`)
          res.writeHead(404)
          res.end('Not found')
        })
      }

      // 開始嘗試
      tryGoogleusercontent()
      return
    }

    // === 通用圖片代理 (googleusercontent 等) ===
    if (path === '/imgproxy') {
      const encodedUrl = query.url
      if (!encodedUrl) {
        res.writeHead(400)
        res.end('Missing url parameter')
        return
      }

      const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
      console.log(`  [IMGPROXY] ${targetUrl}`)

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

    // === DASH Manifest 代理 ===
    if (path === '/manifest') {
      const encodedUrl = query.url
      if (!encodedUrl) {
        res.writeHead(400)
        res.end('Missing url parameter')
        return
      }

      const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
      console.log(`  [MANIFEST] ${targetUrl.substring(0, 80)}...`)

      https.get(targetUrl, (proxyRes) => {
        let data = ''
        proxyRes.on('data', chunk => { data += chunk })
        proxyRes.on('end', () => {
          // 替換 manifest 中的 BaseURL 為代理 URL
          const modifiedData = data.replace(
            /<BaseURL>([^<]+)<\/BaseURL>/g,
            (match, url) => {
              const encoded = Buffer.from(url).toString('base64url')
              return `<BaseURL>http://${HOST_IP}:${PORT}/videoplayback?url=${encoded}</BaseURL>`
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

    // DASH Manifest 端點 (供 Invidious 格式使用)
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
          return
        }

        // 生成 DASH manifest XML
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
      return
    }

    // 影片資訊
    const videoMatch = path.match(/^\/api\/v1\/videos\/([a-zA-Z0-9_-]+)/)
    if (videoMatch) {
      const videoId = videoMatch[1]
      console.log(`  Fetching video: ${videoId}`)
      // 用 Android client 取得影片，URL 不需要解密
      const info = await innertubeAndroid.getBasicInfo(videoId)

      // 用一般 client 取得相關影片和頻道頭像 (Android client 沒有 watch_next_feed)
      let relatedVideos = []
      let channelAvatar = null
      try {
        const fullInfo = await innertube.getInfo(videoId)
        relatedVideos = fullInfo.watch_next_feed || []
        console.log(`  Found ${relatedVideos.length} related videos`)

        // 嘗試從 secondary_info 取得頻道頭像
        const secondaryInfo = fullInfo.secondary_info
        if (secondaryInfo?.owner?.author?.thumbnails?.[0]?.url) {
          channelAvatar = secondaryInfo.owner.author.thumbnails[0].url
          console.log(`  Found channel avatar`)
        }
      } catch (e) {
        console.log(`  Could not get related videos: ${e.message}`)
      }

      const converted = await convertVideoInfo(info, relatedVideos, channelAvatar)
      res.writeHead(200)
      res.end(JSON.stringify(converted))
      return
    }

    // 頻道資訊 (支援子路徑: /videos, /shorts, /playlists, /community)
    const channelMatch = path.match(/^\/api\/v1\/channels\/([a-zA-Z0-9_-]+)(\/([a-z]+))?/)
    if (channelMatch) {
      const channelId = channelMatch[1]
      const subResource = channelMatch[3] // videos, shorts, playlists, community, etc.

      console.log(`  Fetching channel: ${channelId}, subResource: ${subResource || 'info'}`)

      try {
        const channel = await innertube.getChannel(channelId)

        // 如果是子資源請求 (videos, shorts, etc.)
        if (subResource) {
          return await handleChannelSubResource(res, channel, channelId, subResource, query)
        }

        // 主頻道資訊
        const metadata = channel.metadata || {}

        // 取得可用的 tabs
        const tabs = []
        if (channel.has_videos) tabs.push('videos')
        if (channel.has_shorts) tabs.push('shorts')
        if (channel.has_live_streams) tabs.push('live')
        if (channel.has_playlists) tabs.push('playlists')
        if (channel.has_community) tabs.push('community')
        tabs.push('about')

        // 轉換頭像
        const avatarUrl = metadata.avatar?.[0]?.url || ''
        const authorThumbnails = createAuthorThumbnails(avatarUrl)

        // 轉換 Banner
        const bannerUrl = metadata.banner?.[0]?.url || ''
        const authorBanners = bannerUrl ? [
          { url: toGgphtProxyUrl(bannerUrl), width: 1280, height: 720 }
        ] : []

        // 解析訂閱數
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

        // 取得最新影片
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
          authorBanners: authorBanners,
          authorThumbnails: authorThumbnails,
          subCount: subCount,
          totalViews: 0,
          joined: 0,
          autoGenerated: false,
          isFamilyFriendly: metadata.is_family_safe ?? true,
          description: metadata.description || '',
          descriptionHtml: metadata.description || '',
          allowedRegions: [],
          tabs: tabs,
          latestVideos: latestVideos,
          relatedChannels: [],
        }))
        return
      } catch (e) {
        console.error(`  Channel error: ${e.message}`)
        res.writeHead(500)
        res.end(JSON.stringify({ error: e.message }))
        return
      }
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
