# FreeTube Cloudflare Tunnel 設定報告

## 日期
2025-12-29

## 目標
使用 Cloudflare Tunnel 將本地 FreeTube Web 服務暴露到公網，讓外部設備（如手機）可以訪問。

## 架構

```
[手機/外部設備]
       ↓
[Cloudflare Edge] ← freetube.isnowfriend.com
       ↓
[Cloudflare Tunnel (cloudflared)]
       ↓
┌─────────────────────────────────┐
│  本地服務器                      │
│  ├── Web Server (port 9080)    │
│  └── API Server (port 3001)    │
└─────────────────────────────────┘
```

## 安裝的工具

1. **PM2** - Node.js 進程守護
   ```bash
   npm install -g pm2
   ```

2. **Cloudflared** - Cloudflare Tunnel 客戶端
   ```bash
   winget install Cloudflare.cloudflared
   ```
   安裝路徑: `C:\Users\jeffb\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe`

## 配置文件

### PM2 配置 (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [{
    name: 'freetube-web',
    script: '_scripts/dev-runner.js',
    args: '--web',
    cwd: 'C:\\Users\\jeffb\\Desktop\\code\\FreeTube',
    env: { NODE_ENV: 'development' }
  }]
}
```

### Cloudflare Tunnel 配置 (`~/.cloudflared/config.yml`)
```yaml
tunnel: freetube
credentials-file: C:\Users\jeffb\.cloudflared\906cbe40-b8dd-4393-8985-5b07a0a01027.json

ingress:
  - hostname: freetube.isnowfriend.com
    path: /api/*
    service: http://localhost:3001
  - hostname: freetube.isnowfriend.com
    path: /vi/*
    service: http://localhost:3001
  - hostname: freetube.isnowfriend.com
    path: /ggpht/*
    service: http://localhost:3001
  - hostname: freetube.isnowfriend.com
    path: /videoplayback*
    service: http://localhost:3001
  - hostname: freetube.isnowfriend.com
    service: http://localhost:9080
  - service: http_status:404
```

## 代碼修改

### 1. `_scripts/dev-runner.js`
添加 `allowedHosts: 'all'` 和 no-cache headers 解決 "Invalid Host header" 錯誤：
```javascript
const server = new WebpackDevServer({
  open: true,
  allowedHosts: 'all',
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
  // ...
}, compiler)
```

### 2. `src/renderer/store/modules/invidious.js`
在 store 初始化時動態檢測 API URL（關鍵修復）：
```javascript
function getInitialApiUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.hostname}`
  }
  return 'http://localhost:3001'
}

const initialApiUrl = getInitialApiUrl()

const state = {
  currentInvidiousInstance: initialApiUrl,
  currentInvidiousInstanceUrl: initialApiUrl,
  // ...
}
```

### 3. `src/renderer/App.vue`
添加遠程訪問時強制使用同域名 API：
```javascript
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  const apiUrl = `${window.location.protocol}//${window.location.hostname}`
  store.commit('setCurrentInvidiousInstance', apiUrl)
}
```

## 遇到的問題與解決方案

### 問題 1: Invalid Host header
- **原因**: Webpack Dev Server 默認拒絕非 localhost 的 Host header
- **解決**: 添加 `allowedHosts: 'all'` 到 WebpackDevServer 配置

### 問題 2: API 子域名 SSL 錯誤
- **原因**: api.freetube.isnowfriend.com 的 SSL 配置問題
- **解決**: 改用路徑路由而非子域名（`/api/*` → localhost:3001）

### 問題 3: 手機搜尋失敗但電腦正常
- **原因**:
  1. Vuex store 的 `currentInvidiousInstanceUrl` 初始值是空字符串
  2. 遠程訪問時，在 App.vue onMounted 設定 API URL 之前，組件可能已經嘗試調用 API
- **解決**: 在 store 模塊初始化時就設定正確的 API URL

### 問題 4: 代碼更新後手機仍顯示舊版本（最關鍵！）
- **原因**: Cloudflare 邊緣服務器緩存了舊的 JS 文件
- **症狀**:
  - `cf-cache-status: HIT`
  - `Age: 5139` (85分鐘前的版本)
- **解決**: 到 Cloudflare Dashboard → Caching → Configuration → Purge Everything

## 常用命令

```bash
# PM2 管理
pm2 status                    # 查看狀態
pm2 logs                      # 查看日誌
pm2 restart all               # 重啟所有
pm2 start ecosystem.config.js # 啟動

# Cloudflare Tunnel
cloudflared tunnel login      # 登入
cloudflared tunnel run freetube  # 啟動 tunnel

# 清除 Cloudflare 緩存（重要！）
# Dashboard → Caching → Purge Everything
```

## 訪問方式

- **本地**: http://localhost:9080
- **遠程**: https://freetube.isnowfriend.com

## 重要提醒

1. **每次更新代碼後**，如果手機顯示舊版本，需要到 Cloudflare Dashboard 清除緩存
2. **Tunnel 需要保持運行**，可以用 PM2 守護或設定為 Windows 服務
3. **API Server 也需要運行** (`pm2 start local-api-server.js --name freetube-api`)
