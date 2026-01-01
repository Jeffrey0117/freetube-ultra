/**
 * FreeTube Local API Server - Entry Point
 * HTTP 伺服器啟動入口
 */

const http = require('http')
const config = require('./config')
const { createApp, initializeServices } = require('./app')

const { port, host, hostIP } = config.server

/**
 * 啟動 HTTP 伺服器
 */
async function startServer() {
  try {
    // 初始化服務 (YouTube client 等)
    await initializeServices()

    // 建立 HTTP 伺服器
    const app = createApp()
    const server = http.createServer(app)

    // 監聽連接埠
    server.listen(port, host, () => {
      console.log('')
      console.log('='.repeat(50))
      console.log('  FreeTube Local API + Video Proxy')
      console.log('='.repeat(50))
      console.log('')
      console.log(`  API: http://localhost:${port}`)
      console.log(`  For phone: http://${hostIP}:${port}`)
      console.log('')
      console.log('  Endpoints:')
      console.log('    /api/v1/search?q=...')
      console.log('    /api/v1/videos/:id')
      console.log('    /api/v1/channels/:id')
      console.log('    /api/v1/trending')
      console.log('    /videoplayback?url=...')
      console.log('')
      console.log('  Lyrics Cache:')
      console.log('    /api/v1/lyrics/fetch?track=...&artist=...')
      console.log('    /api/v1/lyrics/search?q=...')
      console.log('    /api/v1/lyrics/cache (GET/POST)')
      console.log('    /api/v1/lyrics/stats')
      console.log(`    Cache Dir: ${config.cache.lyricsDir}`)
      console.log('')
      console.log('='.repeat(50))
      console.log('')
    })

    // 處理錯誤
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${port} is already in use`)
      } else {
        console.error('[ERROR] Server error:', err.message)
      }
      process.exit(1)
    })

    // 優雅關閉
    process.on('SIGINT', () => {
      console.log('\n[SERVER] Shutting down...')
      server.close(() => {
        console.log('[SERVER] Closed')
        process.exit(0)
      })
    })

    process.on('SIGTERM', () => {
      console.log('\n[SERVER] Terminating...')
      server.close(() => {
        console.log('[SERVER] Terminated')
        process.exit(0)
      })
    })

  } catch (err) {
    console.error('[FATAL] Failed to start server:', err.message)
    process.exit(1)
  }
}

// 啟動伺服器
startServer()
