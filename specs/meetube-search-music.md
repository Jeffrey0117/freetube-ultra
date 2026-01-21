# MeeTube 搜尋功能與音樂模式

## 概述
為 MeeTube (YouTube 風格主題) 實作搜尋功能和音樂模式，複用 FreeTube 現有的 API 和邏輯。

---

## 功能一：搜尋功能

### 需求
- [x] YtHeader 搜尋框可輸入並觸發搜尋
- [x] 搜尋建議 (debounce 200ms)
- [x] 搜尋結果頁面 YtSearch
- [x] 支援影片、頻道、播放清單結果顯示
- [x] 無限滾動載入更多結果

### 技術規格

#### 相關檔案
| 新建檔案 | 說明 |
|---------|------|
| `src/renderer/views/YtSearch/YtSearch.vue` | 搜尋結果頁面 |

| 修改檔案 | 說明 |
|---------|------|
| `src/renderer/components/yt-theme/YtHeader.vue` | 加入搜尋邏輯 |
| `src/renderer/router/index.js` | 已有 /yt/search/:query 路由 |

#### API 複用
- `getLocalSearchResults(query, filters, safetyMode)` - 本地搜尋
- `getLocalSearchSuggestions(query)` - 搜尋建議
- `invidiousGetSearchResults()` - 備用 Invidious API

#### 資料結構
```javascript
// 搜尋結果項目
{
  type: 'video' | 'channel' | 'playlist',
  videoId / id / playlistId: string,
  title / name: string,
  author / channelName: string,
  thumbnail: string,
  viewCount?: number,
  lengthSeconds?: number
}
```

### 驗收條件
- [x] 在 YtHeader 輸入關鍵字按 Enter 可導向搜尋頁
- [x] 搜尋結果以 YouTube 風格卡片顯示
- [x] 滾動到底部自動載入更多
- [x] 點擊結果可導向對應頁面 (/yt/watch, /yt/channel)

---

## 功能二：音樂模式

### 需求
- [x] YtHeader 加入音樂模式切換按鈕
- [x] 音樂播放頁面 YtMusicPlayer
- [x] 播放控制 (播放/暫停/上下首)
- [x] 進度條拖曳
- [x] 播放佇列顯示

### 技術規格

#### 相關檔案
| 新建檔案 | 說明 |
|---------|------|
| `src/renderer/views/YtMusic/YtMusicPlayer.vue` | 音樂播放器頁面 |

| 修改檔案 | 說明 |
|---------|------|
| `src/renderer/components/yt-theme/YtHeader.vue` | 加入音樂模式按鈕 |
| `src/renderer/router/index.js` | 加入 /yt/music/* 路由 |

#### Store 複用
- `store/modules/musicMode.js` - 播放狀態管理
- Actions: `playTrack`, `togglePlayPause`, `playNext`, `playPrevious`
- State: `currentTrack`, `queue`, `isPlaying`, `currentTime`, `duration`

#### API 複用
- `getAudioStreamUrl(videoId)` - 取得音訊串流 URL
- `getBestAudioFormat(formats)` - 選擇最佳音訊格式

### 驗收條件
- [x] YtHeader 有音樂模式切換按鈕
- [x] 點擊影片可選擇以音樂模式播放
- [x] 音樂播放器有完整播放控制
- [x] 進度條可拖曳跳轉
- [x] 播放佇列可顯示和切換

---

## 實作順序

### Phase 1: 搜尋功能 (優先)
1. 修改 YtHeader 加入搜尋邏輯
2. 建立 YtSearch 頁面
3. 整合搜尋 API
4. 實作無限滾動

### Phase 2: 音樂模式
1. YtHeader 加入音樂按鈕
2. 建立 YtMusicPlayer 頁面
3. 整合 musicMode store
4. 實作播放控制 UI

---

## UI 設計參考

### 搜尋結果頁
- 參考 YouTube 搜尋結果佈局
- 左側縮圖 (16:9)，右側標題、頻道、觀看數、時間
- 響應式：手機垂直排列，桌面水平排列

### 音樂播放器
- 參考 YouTube Music 風格
- 深色背景漸層
- 大型專輯封面居中
- 底部播放控制列
- 紅色進度條

---

## 備註
- 所有 API 邏輯從現有 FreeTube 程式碼複用
- UI 組件使用 Tailwind CSS
- 中文介面 (繁體中文)
