/**
 * FreeTube Local API Server Configuration
 * 集中管理所有設定參數
 */

const os = require('os')
const path = require('path')

// 自動偵測本機 IP
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳過 loopback 和非 IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

// === Server Configuration ===
const config = {
  // 伺服器設定
  server: {
    port: process.env.PORT || 3001,
    host: '0.0.0.0',
    hostIP: process.env.HOST_IP || getLocalIP(),
  },

  // 快取目錄設定
  cache: {
    baseDir: path.join(os.homedir(), '.freetube-cache'),
    lyricsDir: path.join(os.homedir(), '.freetube-cache', 'lyrics'),
  },

  // YouTube client 設定
  youtube: {
    // 一般用途 client (搜尋等)
    defaultClient: {
      lang: 'zh-TW',
      location: 'TW',
      retrieve_player: false,
    },
    // Android client - URLs 不需要解密
    androidClient: {
      lang: 'zh-TW',
      location: 'TW',
      retrieve_player: false,
    },
  },

  // CORS 設定
  cors: {
    allowOrigin: '*',
    allowMethods: 'GET, POST, OPTIONS',
    allowHeaders: 'Range',
    exposeHeaders: 'Content-Length, Content-Range, Accept-Ranges',
  },

  // Proxy 設定
  proxy: {
    timeout: 30000, // 30 秒
    userAgent: 'com.google.android.youtube/19.02.39 (Linux; U; Android 14) gzip',
  },

  // 快取 TTL (秒)
  cacheTTL: {
    thumbnail: 86400, // 1 天
    lyrics: 604800,   // 7 天
  },
}

module.exports = config
