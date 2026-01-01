# FreeTube 效率提升開發規格

## 概述

本文件規劃 FreeTube Web 專案的效率提升工作，分為四個並行開發項目。

---

## Phase 1: 開發流程優化

### 1.1 合併開發指令

**目標**: 一鍵啟動 Web + API 伺服器

**變更檔案**:
- `package.json` - 新增 scripts

**實作內容**:
```json
{
  "scripts": {
    "dev:all": "concurrently -n web,api -c blue,green \"npm run dev:web\" \"npm run dev:api\"",
    "start": "npm run dev:all"
  }
}
```

**依賴安裝**:
```bash
npm install -D concurrently
```

---

### 1.2 PM2 完整設定

**目標**: 生產環境一鍵部署

**變更檔案**:
- `ecosystem.config.js`

**實作內容**:
```javascript
module.exports = {
  apps: [
    {
      name: 'freetube-web',
      script: '_scripts/dev-runner.js',
      args: '--web',
      cwd: __dirname,
      env: { NODE_ENV: 'development' }
    },
    {
      name: 'freetube-api',
      script: 'local-api-server.js',
      cwd: __dirname,
      env: { NODE_ENV: 'development', PORT: 3001 }
    }
  ]
}
```

---

## Phase 2: API Server 模組化

### 2.1 目錄結構

```
server/
├── index.js              # 主入口 (HTTP server 啟動)
├── app.js                # 路由設定
├── config.js             # 設定檔
├── routes/
│   ├── index.js          # 路由聚合
│   ├── search.js         # /api/v1/search
│   ├── videos.js         # /api/v1/videos/:id
│   ├── trending.js       # /api/v1/trending
│   ├── channels.js       # /api/v1/channels/:id
│   ├── lyrics.js         # /api/v1/lyrics
│   └── proxy.js          # /videoplayback, /vi/, /ggpht/
├── services/
│   ├── youtube.js        # youtubei.js 封裝
│   └── lyrics.js         # 歌詞服務
├── cache/
│   ├── index.js          # 快取管理器
│   ├── memory.js         # 記憶體快取
│   └── file.js           # 檔案快取
└── utils/
    ├── url.js            # URL 處理
    └── response.js       # 回應格式化
```

### 2.2 各模組職責

| 模組 | 職責 |
|------|------|
| `routes/search.js` | 處理搜尋請求，呼叫 youtube service |
| `routes/videos.js` | 處理影片資訊請求 |
| `routes/proxy.js` | 代理影片串流、縮圖 |
| `services/youtube.js` | 封裝 youtubei.js，管理 Innertube 實例 |
| `cache/index.js` | 統一快取介面，支援 memory + file |

---

## Phase 3: 快取系統

### 3.1 快取策略

| 資料類型 | 快取時間 | 快取方式 |
|----------|----------|----------|
| 搜尋結果 | 5 分鐘 | Memory |
| 影片資訊 | 1 小時 | Memory + File |
| 頻道資訊 | 24 小時 | Memory + File |
| 歌詞 | 永久 | Memory + File |
| 熱門影片 | 15 分鐘 | Memory |

### 3.2 快取介面

```javascript
// cache/index.js
class CacheManager {
  constructor(options = {}) {
    this.memoryTTL = options.memoryTTL || 300000  // 5 min
    this.fileTTL = options.fileTTL || 3600000     // 1 hour
    this.cacheDir = options.cacheDir || '.cache'
  }

  async get(key, options = {}) { }
  async set(key, value, options = {}) { }
  async delete(key) { }
  async clear() { }

  // 統計
  getStats() { }
}
```

### 3.3 快取 Key 規則

```
search:{query}:{page}
video:{videoId}
channel:{channelId}
trending:{region}
lyrics:{track}:{artist}
```

---

## Phase 4: 程式碼品質

### 4.1 JSDoc 註解規範

所有公開函數必須有 JSDoc:

```javascript
/**
 * 搜尋 YouTube 影片
 * @param {string} query - 搜尋關鍵字
 * @param {Object} options - 選項
 * @param {number} [options.limit=20] - 結果數量
 * @returns {Promise<SearchResult[]>}
 */
async function search(query, options = {}) { }
```

### 4.2 錯誤處理

統一錯誤格式:

```javascript
// utils/response.js
function errorResponse(res, statusCode, message, details = null) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    error: true,
    message,
    details,
    timestamp: Date.now()
  }))
}
```

---

## 實作順序

```
┌─────────────────────────────────────────────────────────────┐
│                    並行開發 (4 Agents)                       │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  Agent 1    │  Agent 2    │  Agent 3    │  Agent 4         │
│  開發流程   │  API 模組化 │  快取系統   │  程式碼品質      │
│             │             │             │                  │
│ • package   │ • server/   │ • cache/    │ • JSDoc          │
│   .json     │   結構建立  │   模組      │ • 錯誤處理       │
│ • PM2 設定  │ • routes    │ • 快取策略  │ • utils          │
│ • README    │ • services  │ • 整合測試  │ • 整合           │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

---

## 完成標準

- [x] `npm run dev:all` 可一鍵啟動 ✅
- [x] API server 拆分為獨立模組 ✅
- [x] 搜尋和影片有快取機制 ✅
- [x] 所有公開 API 有 JSDoc ✅
- [x] 統一錯誤處理格式 ✅
- [x] README 更新開發指令 ✅

## 實作完成報告 (2024-12-31)

### 建立的檔案

```
server/
├── index.js              # HTTP server 入口
├── app.js                # 路由設定與 CORS
├── config.js             # 集中設定檔
├── routes/
│   └── index.js          # 完整路由處理 (從 local-api-server.js 提取)
├── cache/
│   ├── index.js          # CacheManager 主類別
│   ├── memory.js         # 記憶體快取 (TTL + 自動清理)
│   ├── file.js           # 檔案快取 (JSON 格式)
│   └── cache.test.js     # 測試檔案 (29 測試全通過)
└── utils/
    ├── response.js       # HTTP 回應工具
    └── url.js            # URL 編解碼工具
```

### 測試結果

```
快取系統測試: 29/29 通過 (32ms)
- MemoryCache: 9 測試通過
- FileCache: 7 測試通過
- CacheManager: 9 測試通過
- 快取策略: 4 測試通過
```

---

## 預估影響

| 指標 | 改善前 | 改善後 |
|------|--------|--------|
| 啟動複雜度 | 2 個 terminal | 1 個指令 |
| API server 行數 | 1518 行 | ~200 行/檔 |
| 重複搜尋請求 | 每次打 YouTube | 快取命中 |
| 程式碼維護性 | 單一大檔案 | 模組化 |
