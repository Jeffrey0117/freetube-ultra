# FreeTube Web 手機版解決方案

## 我們到底幹了什麼

把 FreeTube 桌面應用變成可以用手機瀏覽器看的 YouTube 播放器，完全繞過 CORS 限制。

## 架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                        手機瀏覽器                            │
│                  http://192.168.0.181:9080                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ LAN
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     你的電腦                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FreeTube Web Dev Server (Port 9080)                │   │
│  │  npm run dev:web                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Local API + Video Proxy Server (Port 3001)         │   │
│  │  node local-api-server.js                           │   │
│  │                                                     │   │
│  │  端點:                                              │
│  │  • /api/v1/search?q=...     搜尋影片               │   │
│  │  • /api/v1/videos/:id       取得影片資訊           │   │
│  │  • /api/v1/trending         熱門影片               │   │
│  │  • /vi/:id/:quality.jpg     影片封面代理           │   │
│  │  • /ggpht/...               頻道頭像代理           │   │
│  │  • /videoplayback?url=...   影片串流代理           │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │ Internet
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      YouTube                                 │
│  • i.ytimg.com          (影片封面)                          │
│  • yt3.ggpht.com        (頻道頭像)                          │
│  • googlevideo.com      (影片串流)                          │
└─────────────────────────────────────────────────────────────┘
```

## 解決的問題

### 1. CORS 限制
瀏覽器不允許直接請求 YouTube API，所以我們自建 API server。

### 2. Invidious 不可靠
公共 Invidious 實例常常掛掉或被封鎖，我們直接用 `youtubei.js` 打 YouTube API。

### 3. 影片 URL 需要解密
YouTube 的影片 URL 需要用 JavaScript 解密 signature，我們改用 Android client 直接拿到可用 URL。

### 4. 影片串流 CORS
`googlevideo.com` 不允許跨域請求，我們在 server 端代理整個影片串流。

### 5. 縮圖 CORS
縮圖圖片也需要代理，包括 `i.ytimg.com` 和 `yt3.ggpht.com`。

## 使用方式

### 啟動服務

```bash
# Terminal 1: 啟動 Web 開發伺服器
npm run dev:web

# Terminal 2: 啟動 API + Video Proxy
node local-api-server.js
```

### 設定 FreeTube

1. 開啟設定
2. 把 Invidious 實例改成: `http://192.168.0.181:3001`

### 手機連線

1. 確保手機和電腦在同一個 WiFi
2. 手機瀏覽器開啟: `http://192.168.0.181:9080`
3. 搜尋影片、點擊播放

## 檔案說明

| 檔案 | 用途 |
|------|------|
| `local-api-server.js` | 核心 API + 代理伺服器 |
| `VIDEO-PROXY-SPEC.md` | 原始規格設計文件 |

## 技術細節

### youtubei.js 設定
```javascript
// Android client 不需要 signature 解密
innertubeAndroid = await Innertube.create({
  client_type: ClientType.ANDROID,
  retrieve_player: false,
})
```

### URL 轉換
```
原始: https://rr1---sn-xxx.googlevideo.com/videoplayback?...
轉換: http://192.168.0.181:3001/videoplayback?url=BASE64(原始URL)
```

### Range Request 支援
影片播放需要支援 Range header 才能 seek，proxy 完整轉發 Range 請求。

## 限制

- 同時只能 1-2 人觀看 (頻寬限制)
- 需要電腦一直開著
- 影片串流經過電腦，會用到網路頻寬

## 日期

2024-12-28 完成
