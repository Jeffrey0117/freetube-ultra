const http = require('http')
const https = require('https')
const { URL } = require('url')

const PORT = 3001

// Try multiple instances
const INSTANCES = [
  'https://invidious.protokolla.fi',
  'https://iv.melmac.space',
]

let currentInstance = INSTANCES[0]

// Test which instance works (test search API, not just stats)
async function testInstance(url) {
  return new Promise((resolve) => {
    const testUrl = url + '/api/v1/search?q=test'
    https.get(testUrl, { timeout: 5000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          JSON.parse(data)
          resolve(true)
        } catch {
          resolve(false)
        }
      })
    }).on('error', () => resolve(false))
  })
}

async function findWorkingInstance() {
  console.log('Testing Invidious instances...')
  for (const instance of INSTANCES) {
    process.stdout.write(`  ${instance} ... `)
    const works = await testInstance(instance)
    if (works) {
      console.log('OK!')
      return instance
    }
    console.log('FAILED')
  }
  return INSTANCES[0] // fallback
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const targetUrl = currentInstance + req.url
  console.log(`[PROXY] ${req.method} ${req.url}`)

  const parsedUrl = new URL(targetUrl)

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    }
  }

  const proxyReq = https.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers }
    headers['access-control-allow-origin'] = '*'
    delete headers['content-security-policy']
    delete headers['x-frame-options']

    // Log response type for debugging
    const contentType = proxyRes.headers['content-type'] || ''
    if (contentType.includes('html')) {
      console.log(`  [WARN] Got HTML response instead of JSON!`)
    }

    res.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (e) => {
    console.error('  [ERROR]', e.message)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e.message }))
  })

  proxyReq.on('timeout', () => {
    console.error('  [TIMEOUT]')
    proxyReq.destroy()
    res.writeHead(504, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Request timeout' }))
  })

  if (req.method === 'POST' || req.method === 'PUT') {
    req.pipe(proxyReq)
  } else {
    proxyReq.end()
  }
})

// Start server after finding working instance
findWorkingInstance().then((instance) => {
  currentInstance = instance

  server.listen(PORT, '0.0.0.0', () => {
    console.log('')
    console.log('='.repeat(50))
    console.log('  FreeTube CORS Proxy - READY')
    console.log('='.repeat(50))
    console.log('')
    console.log(`  Using: ${currentInstance}`)
    console.log(`  Proxy: http://localhost:${PORT}`)
    console.log('')
    console.log('  For phone, set Invidious to:')
    console.log('  http://192.168.0.181:3001')
    console.log('')
    console.log('='.repeat(50))
    console.log('')
  })
})
