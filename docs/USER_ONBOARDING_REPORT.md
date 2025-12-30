# FreeTube 用戶引流與內容發現報告

## 問題陳述

**核心問題**: 如何讓 YouTube 用戶無痛轉移到 FreeTube，不需要：
- 手動搜尋每一個想看的頻道
- 一個一個重新訂閱

---

## 現有 YouTube 用戶的資產

| 資產類型 | 說明 | 可匯入性 |
|----------|------|----------|
| 訂閱頻道 | 用戶關注的所有頻道 | ✅ 可匯出 (Google Takeout) |
| 觀看紀錄 | 看過的影片 | ✅ 可匯出 |
| 播放清單 | 用戶建立的播放清單 | ✅ 可匯出 |
| 按讚影片 | 按過讚的影片 | ✅ 可匯出 |
| 稍後觀看 | Watch Later 清單 | ✅ 可匯出 |
| 推薦算法 | YouTube 個人化推薦 | ❌ 無法匯出 |

---

## 解決方案分析

### 方案 1: YouTube 資料匯入 (最直接)

#### 1.1 訂閱匯入
```
用戶流程:
1. 去 Google Takeout 下載 YouTube 資料
2. 在 FreeTube 點擊「匯入訂閱」
3. 選擇 subscriptions.json 或 subscriptions.csv
4. 一鍵匯入所有訂閱
```

**技術實現**:
- 解析 Google Takeout 的 JSON/CSV 格式
- 批量添加到 FreeTube 本地訂閱列表
- 支援 OPML 格式 (其他 RSS 閱讀器通用)

**FreeTube 現狀**: ✅ 已支援基本匯入功能

#### 1.2 播放清單匯入
```
用戶流程:
1. 貼上 YouTube 播放清單 URL
2. FreeTube 自動抓取清單內容
3. 儲存為本地播放清單
```

**FreeTube 現狀**: ✅ 已支援

#### 1.3 觀看紀錄匯入
```
用戶流程:
1. 匯入 watch-history.json
2. FreeTube 顯示「繼續觀看」
3. 基於歷史提供推薦
```

**FreeTube 現狀**: ⚠️ 部分支援

---

### 方案 2: 無縫跳轉機制

#### 2.1 YouTube URL 直接貼上
```
支援格式:
- https://www.youtube.com/watch?v=xxx
- https://youtu.be/xxx
- https://www.youtube.com/channel/xxx
- https://www.youtube.com/playlist?list=xxx
- https://www.youtube.com/@username
```

**實現**: 在搜尋框貼上 URL → 自動跳轉到對應頁面

**FreeTube 現狀**: ✅ 已支援

#### 2.2 瀏覽器擴充套件
```
功能:
- 在 YouTube 頁面顯示「在 FreeTube 開啟」按鈕
- 自動重定向 YouTube URL 到 FreeTube
- 右鍵選單「用 FreeTube 開啟」
```

**技術**:
- Chrome/Firefox Extension
- 監聽 youtube.com 請求
- 轉換 URL scheme: `freetube://watch?v=xxx`

**FreeTube 現狀**: ⚠️ 社群有非官方版本

#### 2.3 深度連結 (Deep Link)
```
註冊 URL scheme:
freetube://watch?v=VIDEO_ID
freetube://channel/CHANNEL_ID
freetube://search?q=QUERY
```

**用途**:
- 其他 App 可以直接開啟 FreeTube
- 分享連結直接打開 FreeTube

**FreeTube 現狀**: ✅ Electron 支援

---

### 方案 3: 內容發現機制

#### 3.1 智能首頁

```
┌─────────────────────────────────────────────────────┐
│  FreeTube 首頁                                       │
├─────────────────────────────────────────────────────┤
│  📺 訂閱更新 (如果有訂閱)                             │
│  ├── 頻道 A 新影片                                   │
│  └── 頻道 B 新影片                                   │
├─────────────────────────────────────────────────────┤
│  🔥 熱門影片 (Trending)                              │
│  ├── 音樂類熱門                                      │
│  ├── 遊戲類熱門                                      │
│  └── 科技類熱門                                      │
├─────────────────────────────────────────────────────┤
│  📁 瀏覽分類                                         │
│  ├── 音樂 | 遊戲 | 科技 | 教育 | 娛樂 | 新聞         │
├─────────────────────────────────────────────────────┤
│  ⭐ 精選頻道 (人工推薦的優質頻道)                      │
│  ├── 科技: MKBHD, Linus Tech Tips, ...              │
│  ├── 音樂: Vevo, ...                                │
│  └── 教育: Kurzgesagt, Veritasium, ...              │
└─────────────────────────────────────────────────────┘
```

#### 3.2 探索頁面

```
新用戶流程:
1. 首次開啟 → 顯示「選擇你感興趣的類別」
2. 用戶選擇: 音樂、遊戲、科技...
3. 根據選擇顯示推薦頻道
4. 一鍵訂閱多個頻道
```

#### 3.3 頻道推薦引擎 (本地)

```javascript
// 基於用戶行為的本地推薦
const recommendations = {
  // 基於觀看紀錄
  watchedChannels: getFrequentlyWatchedChannels(),

  // 基於訂閱頻道的相關頻道
  relatedChannels: getRelatedChannels(subscriptions),

  // 基於搜尋歷史
  searchBasedChannels: getChannelsFromSearchHistory(),
}
```

---

### 方案 4: 社群驅動

#### 4.1 公開訂閱清單分享
```
用戶流程:
1. 用戶 A 建立「科技頻道精選」訂閱包
2. 分享連結或 QR Code
3. 用戶 B 一鍵匯入整個訂閱包
```

**格式**: JSON 或 OPML
```json
{
  "name": "科技頻道精選 2025",
  "author": "TechEnthusiast",
  "channels": [
    { "id": "UCBJycsmduvYEL83R_U4JriQ", "name": "MKBHD" },
    { "id": "UCXuqSBlHAE6Xw-yeJA0Tunw", "name": "Linus Tech Tips" }
  ]
}
```

#### 4.2 頻道排行榜
```
來源:
- 全球訂閱數排行
- 用戶投票推薦
- 本地用戶訂閱數統計 (匿名)
```

---

### 方案 5: 平台整合

#### 5.1 RSS/Atom Feed 支援
```
優點:
- 標準協議，很多工具支援
- 不依賴 YouTube API
- 可以從其他 RSS 閱讀器匯入

實現:
- 每個 YouTube 頻道都有 RSS feed
- https://www.youtube.com/feeds/videos.xml?channel_id=xxx
```

**FreeTube 現狀**: ✅ 內部使用

#### 5.2 Invidious 實例同步
```
如果用戶已經在用 Invidious:
- 匯入 Invidious 訂閱
- 同步觀看紀錄
- 同步播放清單
```

---

## 推薦實施優先順序

### 第一優先 (立即可做)

| 功能 | 難度 | 影響力 | 說明 |
|------|------|--------|------|
| YouTube URL 智能識別 | 低 | 高 | 貼上任何 YT 連結自動開啟 |
| Google Takeout 匯入優化 | 中 | 高 | 更流暢的匯入流程 |
| 熱門/趨勢頁面 | 低 | 中 | 新用戶有東西可看 |

### 第二優先 (短期)

| 功能 | 難度 | 影響力 | 說明 |
|------|------|--------|------|
| 首次使用引導 | 中 | 高 | 選擇興趣 → 推薦頻道 |
| 訂閱包分享 | 中 | 中 | 社群驅動的內容發現 |
| 瀏覽器擴充套件 | 中 | 高 | 無縫從 YT 跳轉 |

### 第三優先 (中長期)

| 功能 | 難度 | 影響力 | 說明 |
|------|------|--------|------|
| 本地推薦引擎 | 高 | 高 | 基於觀看行為的推薦 |
| 跨設備同步 | 高 | 中 | 訂閱/歷史雲端同步 |
| 深度連結註冊 | 中 | 中 | OS 級別的 URL 處理 |

---

## 競品分析

| 功能 | FreeTube | NewPipe | Invidious |
|------|----------|---------|-----------|
| 訂閱匯入 | ✅ | ✅ | ✅ |
| 播放清單匯入 | ✅ | ✅ | ✅ |
| 觀看紀錄匯入 | ⚠️ | ✅ | ❌ |
| 本地推薦 | ❌ | ❌ | ❌ |
| 瀏覽器擴充 | ⚠️ | N/A | ✅ |
| 跨設備同步 | ❌ | ❌ | ✅ (登入) |
| Trending | ✅ | ✅ | ✅ |
| 分類瀏覽 | ⚠️ | ✅ | ⚠️ |

---

## 用戶旅程設計

### 新用戶 (從 YouTube 來)

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: 首次開啟                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  歡迎來到 FreeTube! 👋                                    │ │
│ │                                                          │ │
│ │  你可以:                                                  │ │
│ │  [📥 匯入 YouTube 訂閱]  ← 推薦，一鍵搬家                  │ │
│ │  [🔍 直接開始搜尋]                                        │ │
│ │  [🔥 瀏覽熱門內容]                                        │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 2: 匯入訂閱 (如果選擇)                                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  匯入你的 YouTube 訂閱                                    │ │
│ │                                                          │ │
│ │  方法 1: Google Takeout (推薦)                            │ │
│ │  → 完整匯入所有訂閱                                       │ │
│ │  → [查看教學]                                             │ │
│ │                                                          │ │
│ │  方法 2: 貼上頻道連結                                     │ │
│ │  → 一次貼一個，適合少量訂閱                               │ │
│ │                                                          │ │
│ │  方法 3: 匯入訂閱包                                       │ │
│ │  → 別人分享的精選頻道                                     │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 3: 選擇興趣 (可選)                                       │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  選擇你感興趣的類別，我們會推薦相關頻道                    │ │
│ │                                                          │ │
│ │  [🎵 音樂] [🎮 遊戲] [💻 科技] [📚 教育]                   │ │
│ │  [🎬 娛樂] [📰 新聞] [🍳 美食] [✈️ 旅遊]                   │ │
│ │                                                          │ │
│ │  [跳過，直接開始 →]                                       │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 4: 推薦頻道                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  根據你選擇的「音樂、科技」，推薦這些頻道:                  │ │
│ │                                                          │ │
│ │  ☑️ MKBHD (1600萬訂閱) - 科技評測                         │ │
│ │  ☑️ Linus Tech Tips (1500萬訂閱) - 科技                   │ │
│ │  ☐ Marques Brownlee (同上)                               │ │
│ │  ☑️ Vevo (熱門音樂)                                       │ │
│ │                                                          │ │
│ │  [訂閱已選頻道 (3)]                                       │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 技術實現建議

### 1. 匯入流程優化

```javascript
// 支援多種匯入格式
const importFormats = {
  // Google Takeout JSON
  'application/json': parseGoogleTakeoutJSON,

  // CSV 格式
  'text/csv': parseCSV,

  // OPML (RSS 閱讀器通用)
  'application/xml': parseOPML,

  // NewPipe 匯出
  'application/zip': parseNewPipeBackup,

  // FreeTube 自己的格式
  'freetube/subscriptions': parseFreeTubeFormat,
}
```

### 2. 頻道推薦資料庫

```javascript
// 預設推薦頻道 (可定期更新)
const curatedChannels = {
  tech: [
    { id: 'UCBJycsmduvYEL83R_U4JriQ', name: 'MKBHD', subs: '16M' },
    { id: 'UCXuqSBlHAE6Xw-yeJA0Tunw', name: 'Linus Tech Tips', subs: '15M' },
  ],
  music: [
    { id: 'UC-9-kyTW8ZkZNDHQJ6FgpwQ', name: 'Music', subs: '100M+' },
  ],
  education: [
    { id: 'UCsXVk37bltHxD1rDPwtNM8Q', name: 'Kurzgesagt', subs: '20M' },
  ],
  // ...
}
```

### 3. 本地推薦引擎 (簡單版)

```javascript
// 基於觀看紀錄的推薦
function getRecommendedChannels() {
  const watchHistory = getWatchHistory()
  const channelStats = {}

  // 統計觀看次數
  for (const video of watchHistory) {
    channelStats[video.channelId] = (channelStats[video.channelId] || 0) + 1
  }

  // 取得這些頻道的相關頻道
  const topChannels = Object.entries(channelStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  // 從 YouTube API 取得相關頻道
  const relatedChannels = await Promise.all(
    topChannels.map(id => getRelatedChannels(id))
  )

  return relatedChannels.flat()
}
```

---

## 結論

**最有效的引流方式 (按影響力排序)**:

1. **一鍵匯入訂閱** - 降低遷移成本
2. **瀏覽器擴充套件** - 無縫跳轉
3. **首次使用引導** - 快速找到感興趣的內容
4. **訂閱包分享** - 社群驅動的傳播
5. **本地推薦引擎** - 長期留存

**核心原則**:
> 讓用戶帶著他們的「數位資產」(訂閱、歷史、清單) 無痛搬家，
> 而不是從零開始。

---

*報告日期: 2025-12-31*
