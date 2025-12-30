/**
 * Lyrics API Helper
 * Uses local API proxy to fetch lyrics from mojigeci.com (避免 CORS 問題)
 */

// 使用相對路徑，會自動使用當前 API server (支援 Cloudflare Tunnel)
const LYRICS_API_BASE = '/api/v1/lyrics'

/**
 * Search for songs by keyword (artist + song name)
 * @param {string} keyword - Search keyword (e.g., "song name artist")
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Results per page (default: 12)
 * @returns {Promise<Array>} - Array of song results
 */
export async function searchLyrics(keyword, page = 1, pageSize = 12) {
  try {
    const params = new URLSearchParams({
      keyword,
      page: page.toString(),
      pageSize: pageSize.toString()
    })

    const response = await fetch(`${LYRICS_API_BASE}/search?${params}`)

    if (!response.ok) {
      throw new Error(`Lyrics search failed: ${response.status}`)
    }

    const result = await response.json()

    if (result.code === 200 && result.data?.data) {
      return result.data.data
    }

    return []
  } catch (error) {
    console.error('[Lyrics] Search error:', error)
    return []
  }
}

/**
 * Get lyrics by song ID
 * @param {number|string} id - Song ID from search results
 * @param {string} songName - Song name
 * @param {string} songArtist - Artist name
 * @param {string} songCover - Cover image URL (optional)
 * @param {string} keyword - Original search keyword (optional)
 * @returns {Promise<Object|null>} - Lyrics data or null
 */
export async function getLyricsById(id, songName, songArtist, songCover = '', keyword = '') {
  try {
    const params = new URLSearchParams({
      id: id.toString(),
      song_name: songName,
      song_artist: songArtist,
      song_cover: songCover,
      keyword: keyword || songName
    })

    const response = await fetch(`${LYRICS_API_BASE}/get?${params}`)

    if (!response.ok) {
      throw new Error(`Lyrics fetch failed: ${response.status}`)
    }

    const result = await response.json()

    if (result.code === 200 && result.data?.data?.lyrics) {
      return {
        lyrics: result.data.data.lyrics,
        tlyric: result.data.data.tlyric, // Translated lyrics if available
        name: result.data.data.name,
        artist: result.data.data.artist,
        cover: result.data.data.cover
      }
    }

    return null
  } catch (error) {
    console.error('[Lyrics] Fetch error:', error)
    return null
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
 * @returns {Promise<{parsed: Array, raw: string}|null>} - Parsed and raw lyrics or null
 */
export async function fetchLyrics(title, artist) {
  try {
    // Clean up title - remove common suffixes like "(Official Video)", "(Lyrics)", etc.
    const cleanTitle = title
      .replace(/\s*[\(\[].*(official|video|audio|lyrics|music|mv|hd|4k|visualizer).*[\)\]]/gi, '')
      .replace(/\s*-\s*(official|video|audio|lyrics).*$/gi, '')
      .trim()

    // Search with artist + title
    const keyword = `${cleanTitle} ${artist}`.trim()
    console.log('[Lyrics] Searching for:', keyword)

    const searchResults = await searchLyrics(keyword)

    if (searchResults.length === 0) {
      console.log('[Lyrics] No results found, trying title only')
      // Try with title only
      const titleOnlyResults = await searchLyrics(cleanTitle)
      if (titleOnlyResults.length === 0) {
        return null
      }
      searchResults.push(...titleOnlyResults)
    }

    // Find best match
    const bestMatch = findBestMatch(searchResults, cleanTitle, artist)

    if (!bestMatch) {
      console.log('[Lyrics] No suitable match found')
      return null
    }

    console.log('[Lyrics] Best match:', bestMatch.name, 'by', bestMatch.artist)

    // Fetch lyrics using the best match
    const lyricsData = await getLyricsById(
      bestMatch.id,
      bestMatch.name,
      Array.isArray(bestMatch.artist) ? bestMatch.artist.join(', ') : bestMatch.artist,
      bestMatch.cover,
      keyword
    )

    if (!lyricsData || !lyricsData.lyrics) {
      return null
    }

    return {
      parsed: parseLRC(lyricsData.lyrics),
      raw: lyricsData.lyrics,
      tlyric: lyricsData.tlyric,
      source: {
        name: lyricsData.name,
        artist: lyricsData.artist,
        cover: lyricsData.cover
      }
    }
  } catch (error) {
    console.error('[Lyrics] fetchLyrics error:', error)
    return null
  }
}

/**
 * Find the best matching song from search results
 * @param {Array} results - Search results
 * @param {string} title - Target song title
 * @param {string} artist - Target artist name
 * @returns {Object|null} - Best matching result or null
 */
function findBestMatch(results, title, artist) {
  if (results.length === 0) return null

  const normalizedTitle = title.toLowerCase()
  const normalizedArtist = artist.toLowerCase()

  // Score each result
  const scored = results.map(result => {
    let score = 0
    const resultName = result.name.toLowerCase()
    const resultArtists = Array.isArray(result.artist)
      ? result.artist.map(a => a.toLowerCase())
      : [result.artist.toLowerCase()]

    // Title matching
    if (resultName === normalizedTitle) {
      score += 100
    } else if (resultName.includes(normalizedTitle) || normalizedTitle.includes(resultName)) {
      score += 50
    }

    // Artist matching
    for (const resultArtist of resultArtists) {
      if (resultArtist === normalizedArtist) {
        score += 100
      } else if (resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist)) {
        score += 50
      }
    }

    // Penalize covers/remixes unless original is a cover/remix
    if (resultName.includes('cover') || resultName.includes('remix') || resultName.includes('原唱')) {
      if (!normalizedTitle.includes('cover') && !normalizedTitle.includes('remix')) {
        score -= 30
      }
    }

    return { result, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Return best match if it has a reasonable score
  if (scored[0].score >= 50) {
    return scored[0].result
  }

  // Otherwise return first result as fallback
  return results[0]
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
