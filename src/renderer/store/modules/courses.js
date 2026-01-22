/**
 * Courses Store Module
 * 管理課程功能 - 把 YouTube 影片組織成課程
 */

const STORAGE_KEY = 'yt-courses'

// 從 localStorage 讀取
function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('[Courses] Failed to load from storage:', e)
    return []
  }
}

// 儲存到 localStorage
function saveToStorage(courses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
  } catch (e) {
    console.error('[Courses] Failed to save to storage:', e)
  }
}

// 生成 UUID
function generateId() {
  return 'course-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
}

const state = {
  courses: loadFromStorage(),
  isCreating: false,
  isSearching: false
}

const getters = {
  getCourses: (state) => state.courses,

  getCourseById: (state) => (id) => {
    return state.courses.find(c => c.id === id)
  },

  getCourseCount: (state) => state.courses.length,

  isCreating: (state) => state.isCreating,
  isSearching: (state) => state.isSearching
}

const actions = {
  async createCourse({ commit, dispatch, state }, { name, keyword }) {
    commit('SET_CREATING', true)
    commit('SET_SEARCHING', true)

    try {
      // 搜尋影片
      const videos = await dispatch('searchVideos', keyword)

      if (videos.length === 0) {
        commit('SET_CREATING', false)
        commit('SET_SEARCHING', false)
        return { success: false, error: '找不到相關影片' }
      }

      // 偵測系列
      const { videos: processedVideos, series } = detectSeries(videos)

      const course = {
        id: generateId(),
        name,
        keyword,
        thumbnail: processedVideos[0]?.thumbnail || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        videos: processedVideos,
        series
      }

      commit('ADD_COURSE', course)
      saveToStorage(state.courses)

      console.log('[Courses] Created course:', course.name, 'with', videos.length, 'videos')

      commit('SET_CREATING', false)
      commit('SET_SEARCHING', false)

      return { success: true, course }
    } catch (e) {
      console.error('[Courses] Failed to create course:', e)
      commit('SET_CREATING', false)
      commit('SET_SEARCHING', false)
      return { success: false, error: e.message }
    }
  },

  async searchVideos(_, keyword) {
    try {
      const response = await fetch(`/api/v1/search?q=${encodeURIComponent(keyword)}`)
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      if (!data || !Array.isArray(data)) {
        return []
      }

      // 只取影片類型，最多 30 個
      const videos = data
        .filter(item => item.type === 'video')
        .slice(0, 30)
        .map(v => ({
          videoId: v.videoId,
          title: v.title,
          author: v.author,
          authorId: v.authorId,
          thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
          duration: v.lengthSeconds || 0,
          viewCount: v.viewCount || 0,
          publishedText: v.publishedText || ''
        }))

      return videos
    } catch (e) {
      console.error('[Courses] Search failed:', e)
      return []
    }
  },

  async refreshCourse({ commit, dispatch, state }, courseId) {
    const course = state.courses.find(c => c.id === courseId)
    if (!course) return { success: false, error: '課程不存在' }

    commit('SET_SEARCHING', true)

    try {
      const videos = await dispatch('searchVideos', course.keyword)

      if (videos.length === 0) {
        commit('SET_SEARCHING', false)
        return { success: false, error: '找不到相關影片' }
      }

      const { videos: processedVideos, series } = detectSeries(videos)

      commit('UPDATE_COURSE', {
        id: courseId,
        updates: {
          videos: processedVideos,
          series,
          thumbnail: processedVideos[0]?.thumbnail || course.thumbnail,
          updatedAt: Date.now()
        }
      })

      saveToStorage(state.courses)
      commit('SET_SEARCHING', false)

      return { success: true }
    } catch (e) {
      commit('SET_SEARCHING', false)
      return { success: false, error: e.message }
    }
  },

  deleteCourse({ commit, state }, courseId) {
    commit('REMOVE_COURSE', courseId)
    saveToStorage(state.courses)
    console.log('[Courses] Deleted course:', courseId)
  },

  clearAllCourses({ commit }) {
    commit('CLEAR_COURSES')
    saveToStorage([])
    console.log('[Courses] Cleared all courses')
  }
}

const mutations = {
  ADD_COURSE(state, course) {
    state.courses.unshift(course)
  },

  UPDATE_COURSE(state, { id, updates }) {
    const index = state.courses.findIndex(c => c.id === id)
    if (index !== -1) {
      state.courses[index] = { ...state.courses[index], ...updates }
    }
  },

  REMOVE_COURSE(state, courseId) {
    state.courses = state.courses.filter(c => c.id !== courseId)
  },

  CLEAR_COURSES(state) {
    state.courses = []
  },

  SET_CREATING(state, value) {
    state.isCreating = value
  },

  SET_SEARCHING(state, value) {
    state.isSearching = value
  }
}

/**
 * 偵測系列影片
 * 規則：
 * 1. 同作者
 * 2. 標題相似（前綴相同或包含序號）
 */
function detectSeries(videos) {
  const seriesMap = new Map()
  const processedVideos = []
  let seriesCounter = 0

  // 按作者分組
  const byAuthor = {}
  videos.forEach(v => {
    if (!byAuthor[v.authorId]) {
      byAuthor[v.authorId] = []
    }
    byAuthor[v.authorId].push(v)
  })

  // 對每個作者的影片偵測系列
  Object.entries(byAuthor).forEach(([authorId, authorVideos]) => {
    if (authorVideos.length < 2) {
      // 單一影片不構成系列
      authorVideos.forEach(v => {
        processedVideos.push({ ...v, seriesGroup: null })
      })
      return
    }

    // 嘗試找出系列
    const grouped = groupByTitleSimilarity(authorVideos)

    grouped.forEach(group => {
      if (group.length >= 2) {
        // 這是一個系列
        const seriesId = `series-${++seriesCounter}`
        const seriesName = extractSeriesName(group.map(v => v.title))

        seriesMap.set(seriesId, {
          id: seriesId,
          name: seriesName,
          author: group[0].author,
          authorId: authorId,
          videoIds: group.map(v => v.videoId)
        })

        group.forEach(v => {
          processedVideos.push({ ...v, seriesGroup: seriesId })
        })
      } else {
        // 單一影片
        group.forEach(v => {
          processedVideos.push({ ...v, seriesGroup: null })
        })
      }
    })
  })

  return {
    videos: processedVideos,
    series: Array.from(seriesMap.values())
  }
}

/**
 * 根據標題相似度分組
 */
function groupByTitleSimilarity(videos) {
  const groups = []
  const used = new Set()

  // 序號模式：EP, Ep, ep, #, 第X集, Part, part, etc.
  const episodePattern = /(?:EP\.?\s*|Ep\.?\s*|ep\.?\s*|#|第\s*|Part\s*|part\s*|Vol\.?\s*|vol\.?\s*)(\d+)/i

  videos.forEach((video, i) => {
    if (used.has(i)) return

    const group = [video]
    used.add(i)

    // 提取標題前綴（去掉序號部分）
    const prefix = video.title.replace(episodePattern, '').trim().toLowerCase()

    // 找相似的影片
    videos.forEach((other, j) => {
      if (i === j || used.has(j)) return

      const otherPrefix = other.title.replace(episodePattern, '').trim().toLowerCase()

      // 檢查相似度
      if (areTitlesSimilar(prefix, otherPrefix)) {
        group.push(other)
        used.add(j)
      }
    })

    groups.push(group)
  })

  return groups
}

/**
 * 檢查兩個標題是否相似
 */
function areTitlesSimilar(a, b) {
  if (!a || !b) return false

  // 完全相同
  if (a === b) return true

  // 計算共同前綴長度
  let commonPrefixLen = 0
  const minLen = Math.min(a.length, b.length)
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      commonPrefixLen++
    } else {
      break
    }
  }

  // 如果共同前綴超過較短字串的 60%，視為相似
  const ratio = commonPrefixLen / minLen
  return ratio >= 0.6
}

/**
 * 從一組標題中提取系列名稱
 */
function extractSeriesName(titles) {
  if (titles.length === 0) return '未命名系列'
  if (titles.length === 1) return titles[0]

  // 找出共同前綴
  let commonPrefix = titles[0]
  for (let i = 1; i < titles.length; i++) {
    commonPrefix = getCommonPrefix(commonPrefix, titles[i])
  }

  // 清理前綴
  commonPrefix = commonPrefix
    .replace(/[-–—|]\s*$/, '') // 移除結尾的分隔符
    .replace(/\s+$/, '') // 移除結尾空白
    .trim()

  return commonPrefix || '系列影片'
}

/**
 * 取得兩個字串的共同前綴
 */
function getCommonPrefix(a, b) {
  let prefix = ''
  const minLen = Math.min(a.length, b.length)
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      prefix += a[i]
    } else {
      break
    }
  }
  return prefix
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
