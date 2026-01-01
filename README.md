<p align="center">
 <img alt="FreeTube Web" src="/_icons/logoColor.svg" width=500 align="center">
</p>

<h3 align="center">FreeTube Web - 手機/瀏覽器版 YouTube 播放器</h3>

<p align="center">
基於 <a href="https://github.com/FreeTubeApp/FreeTube">FreeTube</a> 的 Fork，增加 Web 模式支援，讓你可以在手機瀏覽器上觀看 YouTube 影片。
</p>

---

## 特色功能

- **Web 模式** - 在任何瀏覽器中觀看 YouTube，包括手機
- **無廣告** - 完全沒有 YouTube 廣告
- **隱私保護** - 不使用 Google cookies 或追蹤
- **音樂模式** - 專為音樂聆聽優化的介面，支援歌詞顯示
- **本地 API** - 自建 API 伺服器，不依賴第三方 Invidious 實例
- **影片代理** - 完整繞過 CORS 限制

## 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                        手機/瀏覽器                           │
│                  http://你的電腦IP:9080                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ LAN
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       你的電腦                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Web Dev Server (Port 9080)                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Local API + Video Proxy Server (Port 3001)         │   │
│  │  端點: /api/v1/search, /api/v1/videos/:id, etc.     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                      YouTube
```

## 快速開始

### 環境需求

- Node.js 18+
- npm 或 yarn

### 安裝

```bash
# 安裝依賴
npm install
```

### 開發模式

#### Web 模式 (瀏覽器/手機)

```bash
# 啟動 Web 版本 (含 API 伺服器)
npm run dev:web

# 瀏覽器開啟 http://localhost:9080
# 手機開啟 http://你的電腦IP:9080
```

#### Electron 模式 (桌面)

```bash
# 啟動桌面應用
npm run dev
```

### 手機連線設定

1. 確保手機和電腦在同一個 WiFi 網路
2. 查看電腦的區網 IP (例如: `192.168.0.181`)
3. 在 FreeTube 設定中，將 Invidious 實例改為: `http://你的電腦IP:3001`
4. 手機瀏覽器開啟: `http://你的電腦IP:9080`

## 指令列表

| 指令 | 說明 |
|------|------|
| `npm start` | 同時啟動 Web 和 API 伺服器 (推薦) |
| `npm run dev:all` | 同時啟動 Web 和 API 伺服器 |
| `npm run dev` | 啟動 Electron 桌面應用 |
| `npm run dev:web` | 啟動 Web 版本 (瀏覽器) |
| `npm run dev:api` | 單獨啟動 API 伺服器 |
| `npm run build` | 建置生產版本 |
| `npm run lint` | 程式碼檢查 |
| `npm run lint-fix` | 自動修復程式碼風格 |

## PM2 生產部署

使用 PM2 管理所有服務，方便部署到其他伺服器：

```bash
# 安裝 PM2
npm install -g pm2

# 啟動所有服務 (API + Web + Cloudflare Tunnel)
pm2 start ecosystem.config.js

# 查看狀態
pm2 status

# 查看日誌
pm2 logs

# 重啟所有服務
pm2 restart all

# 停止所有服務
pm2 stop all

# 刪除所有服務
pm2 delete all
```

### ecosystem.config.js 服務

| 服務名稱 | 說明 | 端口 |
|----------|------|------|
| `freetube-api` | 本地 API 伺服器 | 3001 |
| `freetube-web` | Webpack Dev Server | 9080 |
| `freetube-tunnel` | Cloudflare Tunnel | - |

### 部署到新伺服器

1. 複製專案到新伺服器
2. 安裝依賴: `npm install && npm install -g pm2`
3. 安裝 cloudflared (可選，用於公網訪問)
4. 設定 Cloudflare Tunnel (參考 [CLOUDFLARE_TUNNEL_SETUP.md](docs/CLOUDFLARE_TUNNEL_SETUP.md))
5. 啟動: `pm2 start ecosystem.config.js`

## 專案結構

```
FreeTube/
├── src/
│   ├── main/           # Electron 主程序
│   ├── renderer/       # Vue.js 前端
│   │   ├── components/ # UI 元件
│   │   ├── views/      # 頁面視圖
│   │   └── store/      # Vuex 狀態管理
│   └── preload/        # Electron preload 腳本
├── static/             # 靜態資源
│   └── locales/        # 多語言翻譯
├── docs/               # 文件
├── _scripts/           # 建置腳本
├── local-api-server.js # 本地 API 伺服器
└── package.json
```

## 文件

詳細技術文件請參考 `docs/` 目錄：

- [FREETUBE-WEB-MOBILE.md](docs/FREETUBE-WEB-MOBILE.md) - Web/手機版架構說明
- [MUSIC_MODE_SPEC.md](docs/MUSIC_MODE_SPEC.md) - 音樂模式規格
- [LYRICS_SYSTEM.md](docs/LYRICS_SYSTEM.md) - 歌詞系統說明
- [CLOUDFLARE_TUNNEL_SETUP.md](docs/CLOUDFLARE_TUNNEL_SETUP.md) - Cloudflare 隧道設定

## 技術棧

- **前端**: Vue 3, Vuex, Vue Router
- **影片播放**: Shaka Player
- **YouTube API**: youtubei.js
- **桌面應用**: Electron
- **建置工具**: Webpack

## 上游專案

本專案 Fork 自 [FreeTube](https://github.com/FreeTubeApp/FreeTube)，感謝原作者的貢獻。

## 授權

[GNU AGPL v3.0](LICENSE)
