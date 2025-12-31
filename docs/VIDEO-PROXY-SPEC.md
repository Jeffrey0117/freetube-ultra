# FreeTube Web Video Proxy Server 規格書

## 目標
讓 FreeTube Web 版本可以在手機瀏覽器上播放 YouTube 影片，繞過 CORS 限制。

## 架構

```
[手機瀏覽器]
     ↓ LAN (192.168.0.181)
[電腦: FreeTube Web + Proxy Server]
     ↓ Internet
[YouTube / googlevideo.com]
```

## 端點設計

### Port 3001 - API + Video Proxy Server

| 端點 | 功能 |
|------|------|
| `GET /api/v1/search?q=xxx` | 搜尋影片 |
| `GET /api/v1/videos/:id` | 取得影片資訊 (包含 proxy URL) |
| `GET /api/v1/trending` | 熱門影片 |
| `GET /api/v1/channels/:id` | 頻道資訊 |
| `GET /videoplayback/*` | 影片串流代理 |

## 核心流程

### 1. 取得影片資訊
```
Client -> GET /api/v1/videos/dQw4w9WgXcQ
Server -> 用 youtubei.js (Android client) 取得原始 URL
Server -> 將 URL 轉換為 proxy URL
Server -> 回傳給 Client
```

### 2. URL 轉換規則
```
原始: https://rr1---sn-xxx.googlevideo.com/videoplayback?expire=xxx&...
轉換: http://192.168.0.181:3001/videoplayback?url=BASE64(原始URL)
```

### 3. 影片串流代理
```
Client -> GET /videoplayback?url=xxx
Server -> 解碼 URL
Server -> 向 googlevideo.com 發起請求
Server -> 設定 CORS headers
Server -> 串流回傳給 Client
```

## 技術細節

### HTTP Headers 處理

請求到 YouTube:
```
User-Agent: com.google.android.youtube/...
Accept-Encoding: identity (不壓縮)
Range: bytes=xxx-xxx (支援 seek)
```

回應給 Client:
```
Access-Control-Allow-Origin: *
Content-Type: video/mp4 或 audio/webm
Content-Length: xxx
Accept-Ranges: bytes
```

### Range Request 支援
- 必須支援 206 Partial Content
- 瀏覽器會用 Range 來 seek 影片
- 需正確轉發 Range header 和 Content-Range response

### 錯誤處理
- URL 過期 (403) -> 回傳錯誤，Client 重新取得影片資訊
- 連線逾時 -> 10 秒 timeout
- 串流中斷 -> 自動清理

## 實作順序

1. [x] 基本 API Server (local-api-server.js)
2. [ ] 加入 /videoplayback 端點
3. [ ] URL 轉換邏輯 (原始 -> proxy)
4. [ ] Range request 支援
5. [ ] 測試播放

## 效能考量

- 影片直接串流，不快取
- 單一影片約 1-50 Mbps
- 同時觀看數：建議 1-2 個
