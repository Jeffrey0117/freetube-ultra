# FreeTube 歌詞系統技術文檔

## 概述

FreeTube Music Mode 的歌詞系統使用 **LRCLIB** (lrclib.net) 作為歌詞來源，支援同步歌詞 (LRC 格式) 顯示。

## 為什麼選擇 LRCLIB？

### 比較其他方案

| 方案 | 優點 | 缺點 |
|------|------|------|
| **LRCLIB** ✅ | 免費、無需驗證、支援 CORS、LRC 同步歌詞 | 歌曲庫較小 |
| mojigeci.com | 中文歌曲多 | 需要 API 簽名驗證 (api_signature_failed) |
| Musixmatch | 歌曲庫大 | 需要 API Key、有限制 |
| Genius | 歌詞完整 | 只有純文字、無同步 |
| 爬蟲方案 | 靈活 | 維護成本高、法律風險 |

### LRCLIB 的優勢

1. **完全免費** - 開源社群維護
2. **無需驗證** - 不需要 API Key 或簽名
3. **支援 CORS** - 直接從瀏覽器呼叫，不需要後端代理
4. **LRC 格式** - 提供時間戳同步歌詞
5. **RESTful API** - 簡單易用

## 系統架構

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  MusicPlayer    │────▶│   lyrics.js     │────▶│ Local API Server│
│  (Vue Component)│     │   (Helper)      │     │  (with Cache)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       ▼
        │                       │               ┌─────────────────┐
        │                       │               │  File Cache     │
        │                       │               │ ~/.freetube-    │
        │                       │               │ cache/lyrics/   │
        │                       │               └─────────────────┘
        │                       │                       │
        │                       │            Cache Miss │
        │                       │                       ▼
        │                       │               ┌─────────────────┐
        │                       └──fallback───▶│   LRCLIB API    │
        │                                       │   (lrclib.net)  │
        │               ┌─────────────────┐     └─────────────────┘
        │               │   parseLRC()    │
        │               │   解析 LRC 格式   │
        │               └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  歌詞同步顯示    │◀────│  時間戳比對      │
│  自動捲動        │     │  getCurrentIdx  │
└─────────────────┘     └─────────────────┘
```

## 歌詞快取機制

### 本地服務器快取

歌詞請求流程：
1. Client 發送請求到 Local API Server
2. Server 檢查 memory cache (Map)
3. 若 memory miss，檢查 file cache (~/.freetube-cache/lyrics/)
4. 若 file miss，請求 LRCLIB API
5. 成功後同時存入 memory 和 file cache
6. 若 Local Server 不可用，直接請求 LRCLIB

### 快取 API 端點

```
GET  /api/v1/lyrics/fetch?track=...&artist=...  # 自動快取的歌詞獲取
GET  /api/v1/lyrics/search?q=...                 # LRCLIB 搜尋代理
GET  /api/v1/lyrics/cache?track=...&artist=...   # 檢查快取
POST /api/v1/lyrics/cache                        # 手動存入快取
GET  /api/v1/lyrics/stats                        # 快取統計
```

### 快取好處

1. **多裝置共享** - Device A 抓過的歌詞，Device B 直接從本地取
2. **減少 API 請求** - 降低對 LRCLIB 的依賴
3. **離線支援** - 已快取的歌詞可離線使用
4. **加速載入** - 本地快取比網路請求快得多

## API 端點

### 1. 精確匹配 (推薦)

```
GET https://lrclib.net/api/get?track_name={track}&artist_name={artist}
```

**參數：**
- `track_name` - 歌曲名稱
- `artist_name` - 歌手名稱
- `album_name` - 專輯名稱 (選填)
- `duration` - 歌曲長度秒數 (選填，提高匹配準確度)

**回應範例：**
```json
{
  "id": 12345,
  "trackName": "Shape of You",
  "artistName": "Ed Sheeran",
  "albumName": "÷ (Divide)",
  "duration": 234,
  "plainLyrics": "The club isn't the best place...",
  "syncedLyrics": "[00:04.12] The club isn't the best place..."
}
```

### 2. 搜尋 (備用)

```
GET https://lrclib.net/api/search?q={query}
```

**回應：** 返回匹配結果陣列

## LRC 格式解析

### LRC 格式說明

LRC (Lyric) 是一種簡單的歌詞同步格式：

```
[00:12.34] 第一行歌詞
[00:18.56] 第二行歌詞
[00:24.78] 第三行歌詞
```

- `[mm:ss.xx]` - 時間戳 (分:秒.毫秒)
- 一行可以有多個時間戳 (重複歌詞)

### 解析邏輯

```javascript
// 正則表達式匹配時間戳
const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g

// 解析時間為秒數
const time = minutes * 60 + seconds + milliseconds / 1000

// 結果格式
[
  { time: 12.34, text: "第一行歌詞" },
  { time: 18.56, text: "第二行歌詞" },
  { time: 24.78, text: "第三行歌詞" }
]
```

## 歌詞匹配策略

系統使用三階段搜尋策略：

### 第一階段：精確匹配

```javascript
getLyricsByMatch(cleanTitle, cleanArtist, '', duration)
```

直接用歌名和歌手搜尋，成功率最高。

### 第二階段：關鍵字搜尋

```javascript
searchLyrics(cleanTitle, cleanArtist)
findBestMatch(results, cleanTitle, cleanArtist, duration)
```

如果精確匹配失敗，使用搜尋 API 並用評分系統找最佳匹配。

### 第三階段：僅歌名搜尋

```javascript
searchLyrics(cleanTitle)  // 不帶歌手名
```

最後嘗試只用歌名搜尋。

### 評分系統

```javascript
// 標題完全匹配: +100 分
// 標題部分匹配: +50 分
// 歌手完全匹配: +100 分
// 歌手部分匹配: +50 分
// 時長匹配 (±2秒): +50 分
// 時長接近 (±5秒): +30 分
// 有同步歌詞: +20 分
```

## 標題清理

YouTube 影片標題通常包含多餘資訊，需要清理：

```javascript
const cleanTitle = title
  .replace(/\s*[\(\[].*(?:official|video|audio|lyrics|...).*[\)\]]/gi, '')
  .replace(/\s*-\s*(?:official|video|audio|lyrics).*$/gi, '')
  .replace(/\s*\|.*$/gi, '')
  .trim()

const cleanArtist = artist
  .replace(/\s*-\s*Topic$/i, '')  // YouTube Music 的 "- Topic"
  .replace(/VEVO$/i, '')
  .trim()
```

## 同步顯示

### 時間追蹤

```javascript
function getCurrentLyricIndex(lyrics, currentTime) {
  // 從後往前找，返回最後一個已開始的歌詞行
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= currentTime) {
      return i
    }
  }
  return -1
}
```

### 自動捲動

```javascript
function scrollToCurrentLyric() {
  const activeElement = lyricsContainer.querySelector('.lyrics-line.active')
  if (activeElement) {
    activeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}
```

## 檔案結構

```
src/renderer/
├── helpers/api/
│   └── lyrics.js          # 歌詞 API 封裝
├── components/
│   └── MusicPlayer/
│       └── MusicPlayer.vue # 歌詞顯示整合
└── ...
```

## 使用範例

```javascript
import { fetchLyrics, getCurrentLyricIndex } from '@/helpers/api/lyrics'

// 取得歌詞
const lyrics = await fetchLyrics(
  "Shape of You",      // 歌名
  "Ed Sheeran",        // 歌手
  234                  // 時長 (秒)
)

// 回應結構
{
  parsed: [{ time: 4.12, text: "The club isn't..." }, ...],
  raw: "[00:04.12] The club isn't...",
  synced: true,
  source: {
    name: "Shape of You",
    artist: "Ed Sheeran",
    album: "÷ (Divide)"
  }
}

// 在播放時更新當前行
const currentIndex = getCurrentLyricIndex(lyrics.parsed, player.currentTime)
```

## 限制與注意事項

1. **歌曲覆蓋率** - LRCLIB 是社群貢獻，熱門歌曲覆蓋較好，冷門歌曲可能沒有
2. **中文歌曲** - 中文歌詞相對較少，可能需要其他來源
3. **同步精度** - 取決於貢獻者的標記精度
4. **網路依賴** - 需要網路連接才能取得歌詞

## 未來改進方向

1. 添加多來源支援 (Fallback)
2. 本地歌詞快取
3. 用戶自訂歌詞
4. 歌詞翻譯顯示
5. 卡拉 OK 模式 (逐字高亮)

---

*文檔更新日期: 2025-12-31*
