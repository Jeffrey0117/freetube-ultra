# FreeTube Music Mode - MVP Specification

> **Status**: In Progress
> **Last Updated**: 2024-12-30
> **Branch**: `feature/music-mode-mvp`

---

## Overview

將 FreeTube 擴展為音樂播放器，提供類似 YouTube Music 的體驗。

## MVP Scope

### Must Have (MVP)
- [x] Music Home 頁面
- [ ] 分類標籤欄 (Category Pills)
- [ ] 音樂卡片網格 (Music Grid)
- [ ] 歌曲列表 (Songs List)
- [ ] 底部導航欄 (Bottom Nav)
- [ ] 整合現有 MiniPlayer

### Nice to Have (Post-MVP)
- [ ] 媒體庫頁面
- [ ] 離線播放
- [ ] 歌詞顯示

---

## UI Components

### 1. Music Home Layout

```
┌─────────────────────────────────────┐
│  🎵 FreeTube Music      🔍  👤     │  ← Header
├─────────────────────────────────────┤
│ [Trending] [Chill] [Workout] [...]  │  ← Category Pills
├─────────────────────────────────────┤
│  Quick Picks                    →   │
│ ┌───┐ ┌───┐ ┌───┐                  │
│ │ 🎵 │ │ 🎵 │ │ 🎵 │                  │  ← Music Grid
│ └───┘ └───┘ └───┘                  │
│  ● ○ ○                              │  ← Pagination
├─────────────────────────────────────┤
│  Songs                    全部播放  │
│ ┌──┬─────────────────────────┬──┐  │
│ │🖼│ Song Title              │⋮ │  │  ← Songs List
│ │🖼│ Song Title              │⋮ │  │
│ │🖼│ Song Title              │⋮ │  │
│ └──┴─────────────────────────┴──┘  │
├─────────────────────────────────────┤
│ 🖼 Now Playing - Artist      ▶️    │  ← Mini Player
├─────────────────────────────────────┤
│  🏠    🔥    🔍    📚              │  ← Bottom Nav
│ Home  Hot  Search Library          │
└─────────────────────────────────────┘
```

### 2. Component Breakdown

#### 2.1 Category Pills
```vue
<!-- Location: src/renderer/components/music/MusicCategoryPills.vue -->
<template>
  <div class="category-pills">
    <button v-for="cat in categories"
            :class="{ active: selected === cat.id }"
            @click="selectCategory(cat.id)">
      {{ cat.label }}
    </button>
  </div>
</template>
```

**Categories:**
| ID | Label | API Query |
|----|-------|-----------|
| `trending` | Trending | `/api/v1/trending?type=music` |
| `chill` | Chill | search: `chill music playlist` |
| `workout` | Workout | search: `workout music mix` |
| `focus` | Focus | search: `focus study music` |
| `party` | Party | search: `party music hits` |

#### 2.2 Music Card Grid
```vue
<!-- Location: src/renderer/components/music/MusicCardGrid.vue -->
Props:
  - items: Array<MusicItem>
  - columns: number (default: 3)
  - swipeable: boolean

MusicItem:
  - id: string (videoId)
  - title: string
  - thumbnail: string
  - artist: string (channelName)
  - duration: number
```

#### 2.3 Songs List
```vue
<!-- Location: src/renderer/components/music/MusicSongsList.vue -->
Props:
  - songs: Array<Song>
  - showPlayAll: boolean

Events:
  - @play(song)
  - @add-to-queue(song)
  - @play-next(song)
```

#### 2.4 Bottom Navigation
```vue
<!-- Location: src/renderer/components/music/MusicBottomNav.vue -->
Tabs:
  - home: /music
  - hot: /music/trending
  - search: /music/search
  - library: /music/library
```

---

## Routes

```javascript
// src/renderer/router/index.js

// Music Mode Routes
{ path: '/music', name: 'musicHome', component: MusicHome },
{ path: '/music/trending', name: 'musicTrending', component: MusicTrending },
{ path: '/music/search', name: 'musicSearch', component: MusicSearch },
{ path: '/music/library', name: 'musicLibrary', component: MusicLibrary },
{ path: '/music/play/:id', name: 'musicPlay', component: MusicPlayer },
```

---

## API Endpoints

### Local API Server

```javascript
// GET /api/v1/music/home
// Returns: Quick picks + Songs list

// GET /api/v1/music/trending
// Returns: Trending music videos

// GET /api/v1/music/search?q={query}&type=music
// Returns: Music search results
```

---

## File Structure

```
src/renderer/
├── views/
│   └── Music/
│       ├── MusicHome.vue          ← Main music page
│       ├── MusicHome.js
│       ├── MusicHome.css
│       ├── MusicTrending.vue
│       ├── MusicSearch.vue
│       └── MusicLibrary.vue
│
├── components/
│   └── music/
│       ├── MusicCategoryPills.vue
│       ├── MusicCardGrid.vue
│       ├── MusicSongsList.vue
│       ├── MusicSongItem.vue
│       ├── MusicBottomNav.vue
│       └── MusicHeader.vue
```

---

## Development Progress

### Phase 1: Foundation
| Task | Status | Commit |
|------|--------|--------|
| Create docs/MUSIC_MODE_MVP.md | ✅ Done | - |
| Create MusicHome view folder | ⬜ Todo | - |
| Create MusicHome.vue skeleton | ⬜ Todo | - |
| Add /music route | ⬜ Todo | - |

### Phase 2: Components
| Task | Status | Commit |
|------|--------|--------|
| MusicHeader component | ⬜ Todo | - |
| MusicCategoryPills component | ⬜ Todo | - |
| MusicCardGrid component | ⬜ Todo | - |
| MusicSongsList component | ⬜ Todo | - |
| MusicBottomNav component | ⬜ Todo | - |

### Phase 3: Integration
| Task | Status | Commit |
|------|--------|--------|
| Connect to trending API | ⬜ Todo | - |
| Category filtering | ⬜ Todo | - |
| Play music via MiniPlayer | ⬜ Todo | - |
| Queue management | ⬜ Todo | - |

---

## Design Tokens

```css
/* Music Mode Theme */
--music-bg: #0f0f0f;
--music-card-bg: #1a1a1a;
--music-text: #ffffff;
--music-text-secondary: #aaaaaa;
--music-accent: #ff0000;
--music-pill-bg: #272727;
--music-pill-active: #ffffff;
```

---

## Notes

- 使用現有的 `ft-list-video` 可能需要調整樣式
- MiniPlayer 已存在，需整合
- 考慮音樂模式時隱藏影片相關 UI
