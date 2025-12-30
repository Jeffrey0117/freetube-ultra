/**
 * Lyrics API Helper
 * Uses local server cache with LRCLIB.net fallback
 * Local server caches lyrics so multiple devices don't need to call LRCLIB
 */

import store from '../../store/index'

const LRCLIB_API = 'https://lrclib.net/api'

/**
 * Get local API server base URL
 */
function getLocalApiUrl() {
  // Get from Vuex store (settings)
  const currentInvidiousInstance = store.getters.getCurrentInvidiousInstance
  if (currentInvidiousInstance) {
    return currentInvidiousInstance
  }
  // Fallback to localhost
  return 'http://localhost:3001'
}

/**
 * Search for lyrics using local server (with LRCLIB proxy)
 * @param {string} track - Track name
 * @param {string} artist - Artist name
 * @returns {Promise<Array>} - Array of results
 */
export async function searchLyrics(track, artist = '') {
  try {
    const query = artist ? `${track} ${artist}` : track
    const localApi = getLocalApiUrl()

    // Try local server first (proxies to LRCLIB)
    try {
      const response = await fetch(`${localApi}/api/v1/lyrics/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        return await response.json()
      }
    } catch (e) {
      console.log('[Lyrics] Local server unavailable, falling back to direct LRCLIB')
    }

    // Fallback to direct LRCLIB
    const response = await fetch(`${LRCLIB_API}/search?q=${encodeURIComponent(query)}`)

    if (!response.ok) {
      throw new Error(`LRCLIB search failed: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Lyrics] Search error:', error)
    return []
  }
}

/**
 * Get lyrics by exact match (preferred method)
 * Uses local server cache when available
 * @param {string} track - Track name
 * @param {string} artist - Artist name
 * @param {string} album - Album name (optional)
 * @param {number} duration - Duration in seconds (optional)
 * @returns {Promise<Object|null>} - Lyrics data or null
 */
export async function getLyricsByMatch(track, artist, album = '', duration = 0) {
  try {
    const localApi = getLocalApiUrl()

    // Try local server first (has caching)
    try {
      const params = new URLSearchParams({
        track: track,
        artist: artist
      })
      if (duration) params.append('duration', Math.round(duration).toString())

      const response = await fetch(`${localApi}/api/v1/lyrics/fetch?${params}`)

      if (response.status === 404) {
        return null // Not found
      }

      if (response.ok) {
        console.log('[Lyrics] Got lyrics from local server (cached or proxied)')
        return await response.json()
      }
    } catch (e) {
      console.log('[Lyrics] Local server unavailable, falling back to direct LRCLIB')
    }

    // Fallback to direct LRCLIB
    const params = new URLSearchParams({
      track_name: track,
      artist_name: artist
    })
    if (album) params.append('album_name', album)
    if (duration) params.append('duration', Math.round(duration).toString())

    const response = await fetch(`${LRCLIB_API}/get?${params}`)

    if (response.status === 404) {
      return null // Not found
    }

    if (!response.ok) {
      throw new Error(`LRCLIB get failed: ${response.status}`)
    }

    const lyricsData = await response.json()

    // Try to save to local cache (best effort)
    saveLyricsToLocalCache(track, artist, lyricsData)

    return lyricsData
  } catch (error) {
    console.error('[Lyrics] Fetch error:', error)
    return null
  }
}

/**
 * Save lyrics to local server cache (best effort, doesn't block)
 * @param {string} track - Track name
 * @param {string} artist - Artist name
 * @param {Object} lyricsData - Lyrics data to cache
 */
async function saveLyricsToLocalCache(track, artist, lyricsData) {
  try {
    const localApi = getLocalApiUrl()
    await fetch(`${localApi}/api/v1/lyrics/cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track, artist, lyricsData })
    })
    console.log('[Lyrics] Saved to local cache:', track, 'by', artist)
  } catch (e) {
    // Ignore - cache is optional
  }
}

/**
 * Parse LRC format lyrics into timed lines
 * @param {string} lrcText - LRC formatted lyrics
 * @returns {Array<{time: number, text: string}>} - Parsed lyrics with timestamps in seconds
 */
export function parseLRC(lrcText) {
  if (!lrcText) return []

  const lines = lrcText.split('\n')
  const result = []

  // LRC format: [mm:ss.xx] or [mm:ss.xxx] text
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g

  for (const line of lines) {
    const matches = [...line.matchAll(timeRegex)]
    if (matches.length === 0) continue

    // Get the text after the timestamp(s)
    const text = line.replace(timeRegex, '').trim()
    if (!text) continue

    // Each timestamp creates a separate entry (for repeated lines)
    for (const match of matches) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const milliseconds = parseInt(match[3].padEnd(3, '0'), 10)
      const time = minutes * 60 + seconds + milliseconds / 1000

      result.push({ time, text })
    }
  }

  // Sort by time
  result.sort((a, b) => a.time - b.time)

  return result
}

/**
 * Search and fetch lyrics for a song
 * @param {string} title - Song title
 * @param {string} artist - Artist name
 * @param {number} duration - Duration in seconds (optional, improves matching)
 * @returns {Promise<{parsed: Array, raw: string, synced: boolean}|null>} - Parsed and raw lyrics or null
 */
export async function fetchLyrics(title, artist, duration = 0) {
  try {
    // Clean up title - remove common suffixes like "(Official Video)", "(Lyrics)", etc.
    const cleanTitle = title
      .replace(/\s*[\(\[].*(?:official|video|audio|lyrics|music|mv|hd|4k|visualizer|remaster|live).*[\)\]]/gi, '')
      .replace(/\s*-\s*(?:official|video|audio|lyrics).*$/gi, '')
      .replace(/\s*\|.*$/gi, '') // Remove everything after |
      .trim()

    const cleanArtist = artist
      .replace(/\s*-\s*Topic$/i, '') // Remove "- Topic" suffix from YouTube Music
      .replace(/VEVO$/i, '')
      .trim()

    console.log('[Lyrics] Searching for:', cleanTitle, 'by', cleanArtist)

    // Method 1: Try exact match first (best quality)
    let lyricsData = await getLyricsByMatch(cleanTitle, cleanArtist, '', duration)

    // Method 2: Search if exact match fails
    if (!lyricsData || !lyricsData.syncedLyrics) {
      console.log('[Lyrics] Exact match failed, trying search...')
      const searchResults = await searchLyrics(cleanTitle, cleanArtist)

      if (searchResults.length > 0) {
        // Find best match with synced lyrics
        const bestMatch = findBestMatch(searchResults, cleanTitle, cleanArtist, duration)
        if (bestMatch) {
          lyricsData = bestMatch
        }
      }
    }

    // Method 3: Try title only
    if (!lyricsData || !lyricsData.syncedLyrics) {
      console.log('[Lyrics] Trying title only search...')
      const titleOnlyResults = await searchLyrics(cleanTitle)
      if (titleOnlyResults.length > 0) {
        const bestMatch = findBestMatch(titleOnlyResults, cleanTitle, cleanArtist, duration)
        if (bestMatch) {
          lyricsData = bestMatch
        }
      }
    }

    if (!lyricsData) {
      console.log('[Lyrics] No lyrics found')
      return null
    }

    // Prefer synced lyrics, fall back to plain lyrics
    const lrcText = lyricsData.syncedLyrics || lyricsData.plainLyrics
    if (!lrcText) {
      return null
    }

    console.log('[Lyrics] Found:', lyricsData.trackName, 'by', lyricsData.artistName)

    return {
      parsed: lyricsData.syncedLyrics ? parseLRC(lyricsData.syncedLyrics) : [],
      raw: lrcText,
      synced: !!lyricsData.syncedLyrics,
      source: {
        name: lyricsData.trackName,
        artist: lyricsData.artistName,
        album: lyricsData.albumName
      }
    }
  } catch (error) {
    console.error('[Lyrics] fetchLyrics error:', error)
    return null
  }
}

/**
 * Find the best matching song from LRCLIB search results
 * @param {Array} results - Search results from LRCLIB
 * @param {string} title - Target song title
 * @param {string} artist - Target artist name
 * @param {number} duration - Target duration in seconds
 * @returns {Object|null} - Best matching result with syncedLyrics, or null
 */
function findBestMatch(results, title, artist, duration = 0) {
  // Filter to only results with synced lyrics
  const withSynced = results.filter(r => r.syncedLyrics)
  const candidates = withSynced.length > 0 ? withSynced : results

  if (candidates.length === 0) return null

  const normalizedTitle = title.toLowerCase()
  const normalizedArtist = artist.toLowerCase()

  // Score each result
  const scored = candidates.map(result => {
    let score = 0
    const resultName = (result.trackName || '').toLowerCase()
    const resultArtist = (result.artistName || '').toLowerCase()

    // Title matching
    if (resultName === normalizedTitle) {
      score += 100
    } else if (resultName.includes(normalizedTitle) || normalizedTitle.includes(resultName)) {
      score += 50
    }

    // Artist matching
    if (resultArtist === normalizedArtist) {
      score += 100
    } else if (resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist)) {
      score += 50
    }

    // Duration matching (within 5 seconds is good)
    if (duration > 0 && result.duration) {
      const durationDiff = Math.abs(result.duration - duration)
      if (durationDiff <= 2) {
        score += 50
      } else if (durationDiff <= 5) {
        score += 30
      } else if (durationDiff <= 10) {
        score += 10
      }
    }

    // Bonus for having synced lyrics
    if (result.syncedLyrics) {
      score += 20
    }

    return { result, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Return best match if it has a reasonable score
  if (scored[0].score >= 30) {
    return scored[0].result
  }

  // Otherwise return first result with synced lyrics as fallback
  return withSynced[0] || candidates[0]
}

/**
 * Find the current lyric line index based on playback time
 * @param {Array<{time: number, text: string}>} lyrics - Parsed lyrics array
 * @param {number} currentTime - Current playback time in seconds
 * @returns {number} - Index of current lyric line (-1 if before first line)
 */
export function getCurrentLyricIndex(lyrics, currentTime) {
  if (!lyrics || lyrics.length === 0) return -1

  // Find the last lyric line that has started
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= currentTime) {
      return i
    }
  }

  return -1
}
