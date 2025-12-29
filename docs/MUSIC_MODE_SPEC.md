# FreeTube Music Mode 功能規格

## 概述

為 FreeTube Web 版新增「音樂模式」，提供類似 YouTube Music 的使用體驗，專為音樂播放優化的介面。

## 目標用戶

- 手機版用戶
- 想要背景播放音樂的用戶
- 想要連續播放某個歌手/頻道所有歌曲的用戶

---

## 功能需求

### 1. 模式切換

| 功能 | 說明 |
|------|------|
| 切換按鈕 | 頂部導航欄新增「音樂/影片」切換開關 |
| 記住偏好 | 使用 localStorage 記住用戶上次選擇的模式 |
| URL 參數 | 支援 `?mode=music` 直接進入音樂模式 |

### 2. 音樂播放器介面 (Music Player UI)

```
┌─────────────────────────────────┐
│  ←    [Song] [Video]    🔗  ⋮  │  ← 頂部導航
├─────────────────────────────────┤
│                                 │
│     ┌───────────────────┐       │
│     │                   │       │
│     │    Album Art      │       │  ← 大型封面圖
│     │    (Thumbnail)    │       │
│     │                   │       │
│     └───────────────────┘       │
│                                 │
│         Song Title              │  ← 歌曲標題
│     Artist / Channel Name       │  ← 藝人/頻道名稱
│                                 │
│   👍 572K  👎  💬 948  ≡+ Save  │  ← 互動按鈕
│                                 │
│   ●━━━━━━━━━━━━━━━━━━○─────────  │  ← 進度條
│   1:53                    3:23  │  ← 時間顯示
│                                 │
│     🔀    ⏮    ▶️    ⏭    🔁   │  ← 播放控制
│                                 │
├─────────────────────────────────┤
│  [UP NEXT]  [LYRICS]  [RELATED] │  ← 底部標籤頁
└─────────────────────────────────┘
```

### 3. 核心功能

#### 3.1 播放控制
- [ ] 播放/暫停
- [ ] 上一首/下一首
- [ ] 隨機播放 (Shuffle)
- [ ] 重複播放 (單曲循環/列表循環/不循環)
- [ ] 進度條拖曳
- [ ] 音量控制

#### 3.2 頻道/歌手播放模式
- [ ] 「播放此頻道所有影片」按鈕
- [ ] 自動過濾非音樂內容（使用影片長度、標題關鍵字）
- [ ] 按發布日期/熱門程度排序
- [ ] 建立臨時播放清單

#### 3.3 底部標籤頁

| 標籤 | 功能 |
|------|------|
| **UP NEXT** | 顯示播放佇列，可拖曳排序 |
| **LYRICS** | 歌詞顯示（需整合歌詞 API）|
| **RELATED** | 相關推薦歌曲 |

#### 3.4 迷你播放器
- [ ] 離開播放頁面時，底部顯示迷你播放器
- [ ] 顯示：封面縮圖、歌曲名、播放/暫停按鈕
- [ ] 點擊展開完整播放器

---

## 技術設計

### 新增組件

```
src/renderer/components/
├── MusicPlayer/
│   ├── MusicPlayer.vue          # 主播放器
│   ├── MusicPlayer.js
│   ├── MusicPlayer.css
│   ├── MusicPlayerControls.vue  # 播放控制
│   ├── MusicPlayerProgress.vue  # 進度條
│   └── MusicPlayerQueue.vue     # 播放佇列
├── MiniPlayer/
│   ├── MiniPlayer.vue           # 迷你播放器
│   └── MiniPlayer.css
└── MusicModeToggle/
    └── MusicModeToggle.vue      # 模式切換開關
```

### 新增路由

```javascript
// router/index.js
{
  path: '/music',
  name: 'musicHome',
  component: MusicHome
},
{
  path: '/music/channel/:id',
  name: 'musicChannel',
  component: MusicChannelPlayer
},
{
  path: '/music/play/:id',
  name: 'musicPlay',
  component: MusicPlayer
}
```

### 新增 Store Module

```javascript
// store/modules/musicMode.js
export default {
  state: {
    isMusicMode: false,
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    shuffleEnabled: false,
    repeatMode: 'none', // 'none' | 'one' | 'all'
    isPlaying: false
  },

  mutations: {
    SET_MUSIC_MODE,
    SET_CURRENT_TRACK,
    SET_QUEUE,
    ADD_TO_QUEUE,
    REMOVE_FROM_QUEUE,
    SET_SHUFFLE,
    SET_REPEAT_MODE,
    SET_PLAYING
  },

  actions: {
    playTrack,
    playNext,
    playPrevious,
    playChannelAll,      // 播放頻道所有歌曲
    addToQueue,
    clearQueue
  }
}
```

### API 整合

```javascript
// helpers/api/music.js

/**
 * 獲取頻道所有影片（用於播放歌手所有歌曲）
 */
async function getChannelVideos(channelId, options = {}) {
  // 使用 Invidious API 或 youtubei.js
  // 過濾條件：
  // - 影片長度 < 10 分鐘（排除長影片）
  // - 排除 Shorts
  // - 可選：標題包含音樂相關關鍵字
}

/**
 * 判斷影片是否為音樂內容
 */
function isMusicContent(video) {
  const musicKeywords = ['official', 'music', 'mv', 'audio', 'lyric', 'song']
  const title = video.title.toLowerCase()
  const duration = video.lengthSeconds

  return duration < 600 && // < 10 分鐘
         duration > 60 &&  // > 1 分鐘
         (video.genre === 'Music' ||
          musicKeywords.some(kw => title.includes(kw)))
}
```

---

## UI/UX 規格

### 色彩配置 (Dark Theme)

```css
:root {
  --music-bg-primary: #0f0f0f;
  --music-bg-secondary: #1a1a1a;
  --music-accent: #ff0000;
  --music-text-primary: #ffffff;
  --music-text-secondary: #aaaaaa;
  --music-progress-bg: #404040;
  --music-progress-active: #ff0000;
}
```

### 響應式設計

| 斷點 | 佈局 |
|------|------|
| < 480px | 全螢幕播放器，底部控制 |
| 480px - 768px | 同上，稍大間距 |
| > 768px | 可選擇分屏顯示佇列 |

### 動畫效果

- 封面圖片：播放時輕微縮放動畫
- 進度條：平滑過渡
- 頁面切換：滑動過渡
- 迷你播放器：上滑展開動畫

---

## 實作階段

### Phase 1: 基礎音樂播放器 (MVP) ✅ COMPLETED
1. [x] 音樂模式切換開關
2. [x] 音樂播放器 UI
3. [x] 基本播放控制（播放/暫停/上下首）
4. [x] 進度條
5. [x] MiniPlayer 迷你播放器
6. [x] 音樂模式 Store 狀態管理
7. [x] 音樂模式路由

### Phase 2: 播放佇列
1. [ ] 播放佇列管理
2. [ ] 隨機播放
3. [ ] 重複播放模式
4. [ ] UP NEXT 標籤頁

### Phase 3: 頻道播放
1. [ ] 頻道頁面「播放全部」按鈕
2. [ ] 自動過濾音樂內容
3. [ ] 頻道音樂清單頁面

### Phase 4: 進階功能
1. [ ] 迷你播放器
2. [ ] RELATED 推薦
3. [ ] LYRICS 歌詞顯示（整合第三方 API）
4. [ ] 背景播放支援

---

## 相依性

- 現有 Shaka Player 組件（重用音頻播放邏輯）
- Vue Router（新路由）
- Vuex Store（狀態管理）
- Invidious API / youtubei.js（獲取頻道影片）

## 風險與挑戰

| 風險 | 緩解措施 |
|------|----------|
| 歌詞 API 可能不穩定 | 設為可選功能，無歌詞時隱藏標籤 |
| 頻道影片過多造成載入慢 | 分頁載入，lazy loading |
| 非音樂內容誤判 | 提供用戶手動過濾選項 |
| 背景播放在某些瀏覽器受限 | 提示用戶使用 PWA 或桌面版 |

---

## 參考資料

- YouTube Music 手機 App UI
- 現有 FreeTube 播放器組件
- Shaka Player 文檔
