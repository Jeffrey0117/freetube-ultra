/**
 * Music Mode API Helpers
 * 提供音樂模式所需的 API 功能
 */

import { invidiousGetVideoInformation } from './invidious'

/**
 * 從 adaptiveFormats 中提取最佳音訊格式
 * @param {Array} adaptiveFormats - Invidious API 返回的 adaptiveFormats
 * @returns {Object|null} 最佳音訊格式物件
 */
export function getBestAudioFormat(adaptiveFormats) {
  console.log('[Music] getBestAudioFormat called with', adaptiveFormats?.length || 0, 'formats')

  if (!adaptiveFormats || adaptiveFormats.length === 0) {
    console.log('[Music] getBestAudioFormat: No adaptiveFormats provided')
    return null
  }

  // 過濾出純音訊格式 (type 以 audio/ 開頭)
  const audioFormats = adaptiveFormats.filter(format => {
    const isAudio = format.type && format.type.startsWith('audio/')
    if (!isAudio) {
      console.log('[Music] Skipping non-audio format:', format.type)
    }
    return isAudio
  })

  console.log('[Music] Found', audioFormats.length, 'audio formats after filtering')

  if (audioFormats.length === 0) {
    console.log('[Music] getBestAudioFormat: No audio formats found after filtering')
    return null
  }

  // 按 bitrate 排序，選擇最高品質
  audioFormats.sort((a, b) => {
    const bitrateA = parseInt(a.bitrate) || 0
    const bitrateB = parseInt(b.bitrate) || 0
    return bitrateB - bitrateA
  })

  console.log('[Music] Selected best audio format:', {
    type: audioFormats[0].type,
    bitrate: audioFormats[0].bitrate,
    audioQuality: audioFormats[0].audioQuality
  })

  return audioFormats[0]
}

/**
 * 獲取影片的音訊串流 URL
 * @param {string} videoId - YouTube 影片 ID
 * @returns {Promise<{audioUrl: string, videoInfo: Object}|null>}
 */
export async function getAudioStreamUrl(videoId) {
  console.log('[Music] getAudioStreamUrl called with videoId:', videoId)

  try {
    console.log('[Music] Calling invidiousGetVideoInformation...')
    const videoInfo = await invidiousGetVideoInformation(videoId)
    console.log('[Music] invidiousGetVideoInformation response:', {
      hasVideoInfo: !!videoInfo,
      title: videoInfo?.title,
      hasAdaptiveFormats: !!videoInfo?.adaptiveFormats,
      adaptiveFormatsCount: videoInfo?.adaptiveFormats?.length || 0,
      error: videoInfo?.error
    })

    if (videoInfo.error) {
      console.error('[Music] Failed to get video info:', videoInfo.error)
      return null
    }

    // 除錯：列出所有可用格式
    if (videoInfo.adaptiveFormats) {
      console.log('[Music] Available adaptive formats:')
      videoInfo.adaptiveFormats.forEach((format, index) => {
        console.log(`  [${index}] type: ${format.type}, bitrate: ${format.bitrate}, url: ${format.url?.substring(0, 80)}...`)
      })
    }

    const audioFormat = getBestAudioFormat(videoInfo.adaptiveFormats)
    console.log('[Music] getBestAudioFormat result:', {
      hasAudioFormat: !!audioFormat,
      type: audioFormat?.type,
      bitrate: audioFormat?.bitrate,
      audioQuality: audioFormat?.audioQuality,
      url: audioFormat?.url?.substring(0, 100)
    })

    if (!audioFormat) {
      console.error('[Music] No audio format found for video:', videoId)
      console.error('[Music] adaptiveFormats was:', videoInfo.adaptiveFormats)
      return null
    }

    // 處理 URL - 如果是相對路徑，加上 origin
    let audioUrl = audioFormat.url
    console.log('[Music] Original audio URL:', audioUrl?.substring(0, 100))

    if (audioUrl.startsWith('/')) {
      audioUrl = `${window.location.origin}${audioUrl}`
      console.log('[Music] Converted to absolute URL:', audioUrl?.substring(0, 100))
    }

    const result = {
      audioUrl,
      audioFormat,
      videoInfo: {
        videoId: videoInfo.videoId,
        title: videoInfo.title,
        author: videoInfo.author,
        authorId: videoInfo.authorId,
        lengthSeconds: videoInfo.lengthSeconds,
        viewCount: videoInfo.viewCount,
        likeCount: videoInfo.likeCount,
        description: videoInfo.description,
        published: videoInfo.published,
        recommendedVideos: videoInfo.recommendedVideos || []
      }
    }

    console.log('[Music] getAudioStreamUrl returning successfully:', {
      audioUrl: result.audioUrl?.substring(0, 100),
      title: result.videoInfo.title
    })

    return result
  } catch (error) {
    console.error('[Music] Error getting audio stream:', error)
    console.error('[Music] Error stack:', error.stack)
    return null
  }
}

/**
 * 判斷影片是否可能是音樂內容
 * @param {Object} video - 影片物件
 * @returns {boolean}
 */
export function isMusicContent(video) {
  const musicKeywords = [
    'official', 'music', 'mv', 'audio', 'lyric', 'lyrics',
    'song', 'official video', 'official audio', 'official mv',
    'music video', 'live', 'acoustic', 'cover', 'remix'
  ]

  const title = (video.title || '').toLowerCase()
  const duration = video.lengthSeconds || video.duration || 0

  // 長度在 1-10 分鐘之間，且標題包含音樂關鍵字
  const isRightLength = duration > 60 && duration < 600

  // 檢查標題是否包含音樂關鍵字
  const hasMusicKeyword = musicKeywords.some(kw => title.includes(kw))

  // 檢查分類是否為音樂
  const isMusicGenre = video.genre === 'Music' || video.category === 'Music'

  return isRightLength && (hasMusicKeyword || isMusicGenre)
}

/**
 * 從影片列表中過濾出音樂內容
 * @param {Array} videos - 影片列表
 * @returns {Array} 過濾後的音樂影片列表
 */
export function filterMusicContent(videos) {
  if (!videos || !Array.isArray(videos)) {
    return []
  }

  return videos.filter(isMusicContent)
}

/**
 * 將影片物件轉換為 track 物件（用於播放佇列）
 * @param {Object} video - 影片物件
 * @param {string} audioUrl - 音訊 URL（可選）
 * @returns {Object} track 物件
 */
export function videoToTrack(video, audioUrl = null) {
  return {
    videoId: video.videoId,
    title: video.title,
    author: video.author || video.authorId,
    authorId: video.authorId,
    lengthSeconds: video.lengthSeconds || video.duration,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    audioUrl: audioUrl,
    thumbnail: `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`
  }
}
