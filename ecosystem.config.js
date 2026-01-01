const path = require('path')
const os = require('os')

// Cloudflared 路徑 (根據系統調整)
const CLOUDFLARED_PATH = process.platform === 'win32'
  ? path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe/cloudflared.exe')
  : 'cloudflared'

module.exports = {
  apps: [
    // API Server (必須先啟動)
    {
      name: 'freetube-api',
      script: 'local-api-server.js',
      cwd: __dirname,
      env: { NODE_ENV: 'development', PORT: 3001 }
    },
    // Web Dev Server
    {
      name: 'freetube-web',
      script: '_scripts/dev-runner.js',
      args: '--web --no-api',  // 不啟動內建 API
      cwd: __dirname,
      env: { NODE_ENV: 'development', SKIP_API_SERVER: 'true' }
    },
    // Cloudflare Tunnel (可選)
    {
      name: 'freetube-tunnel',
      script: CLOUDFLARED_PATH,
      args: 'tunnel run freetube',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000
    }
  ]
}
