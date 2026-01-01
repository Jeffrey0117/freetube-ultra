/**
 * FreeTube Local API Server - Application
 * 路由分發與 CORS 設定
 */

const { Innertube, ClientType } = require('youtubei.js')
const config = require('./config')
const routes = require('./routes')

// YouTube.js clients (全域共享)
let innertube = null
let innertubeAndroid = null

/**
 * 取得 YouTube.js 一般 client
 */
function getInnertube() {
  return innertube
}

/**
 * 取得 YouTube.js Android client
 */
function getInnertubeAndroid() {
  return innertubeAndroid
}

/**
 * 初始化服務 (YouTube clients 等)
 */
async function initializeServices() {
  console.log('Initializing YouTube.js...')

  // 一般用途 (搜尋等)
  innertube = await Innertube.create({
    ...config.youtube.defaultClient,
  })

  // Android client - URLs 不需要解密
  innertubeAndroid = await Innertube.create({
    ...config.youtube.androidClient,
    client_type: ClientType.ANDROID,
  })

  console.log('YouTube.js ready!')
}

/**
 * 解析 URL 查詢參數
 */
function parseQuery(url) {
  const queryString = url.split('?')[1] || ''
  const params = {}
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=')
    if (key) params[key] = decodeURIComponent(value || '')
  })
  return params
}

/**
 * 設定 CORS headers
 */
function setCorsHeaders(res) {
  const { cors } = config
  res.setHeader('Access-Control-Allow-Origin', cors.allowOrigin)
  res.setHeader('Access-Control-Allow-Methods', cors.allowMethods)
  res.setHeader('Access-Control-Allow-Headers', cors.allowHeaders)
  res.setHeader('Access-Control-Expose-Headers', cors.exposeHeaders)
}

/**
 * 建立請求處理 app
 */
function createApp() {
  return async function app(req, res) {
    // 設定 CORS
    setCorsHeaders(res)

    // 處理 preflight 請求
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
      // 建立請求上下文
      const context = {
        req,
        res,
        path,
        query,
        url,
        innertube,
        innertubeAndroid,
      }

      // 路由處理
      const handled = await routes.handleRequest(context)

      // 如果沒有匹配的路由，返回 404
      if (!handled) {
        res.setHeader('Content-Type', 'application/json')
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found' }))
      }

    } catch (error) {
      console.error('[ERROR]', error.message)
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json')
        res.writeHead(500)
        res.end(JSON.stringify({ error: error.message }))
      }
    }
  }
}

module.exports = {
  createApp,
  initializeServices,
  getInnertube,
  getInnertubeAndroid,
  parseQuery,
  setCorsHeaders,
}
