/**
 * FreeTube Web Proxy Server
 * 解決 CORS 問題，讓 Web 版本可以正常運作
 *
 * 使用方式：node proxy-server.js
 * 然後在瀏覽器開啟：http://localhost:9080 或 http://你的IP:9080
 */

const http = require('http')
const https = require('https')
const { spawn } = require('child_process')
const path = require('path')

const PROXY_PORT = 3001
const INVIDIOUS_INSTANCE = 'https://iv.ggtyler.dev' // CORS 支援的實例

// 建立代理伺服器
const proxyServer = http.createServer((req, res) => {
  // 設定 CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // 代理到 Invidious
  if (req.url.startsWith('/api/')) {
    const targetUrl = `${INVIDIOUS_INSTANCE}${req.url}`
    console.log(`[Proxy] ${req.method} ${targetUrl}`)

    const proxyReq = https.request(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(INVIDIOUS_INSTANCE).host
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*'
      })
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (err) => {
      console.error('[Proxy Error]', err.message)
      res.writeHead(502)
      res.end('Proxy Error: ' + err.message)
    })

    req.pipe(proxyReq)
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

proxyServer.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`\n========================================`)
  console.log(`  FreeTube Web Proxy Server`)
  console.log(`========================================`)
  console.log(`\n  Proxy API: http://localhost:${PROXY_PORT}/api/`)
  console.log(`  Invidious: ${INVIDIOUS_INSTANCE}`)
  console.log(`\n========================================\n`)
})

console.log('Starting FreeTube Web Dev Server...')
