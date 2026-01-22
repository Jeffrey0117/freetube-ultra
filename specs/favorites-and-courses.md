# 收藏影片與課程功能規格

## 概述
為 MeeTube 加入收藏影片功能和線上課程結構，讓使用者可以收藏喜歡的影片，並透過關鍵字自動建立課程。

---

## 功能一：收藏影片

### 需求
- [ ] 影片頁面加入「收藏」按鈕（愛心圖示）
- [ ] 點擊後加入收藏列表
- [ ] 已收藏的影片顯示實心愛心
- [ ] 收藏資料儲存到 localStorage
- [ ] 收藏頁面 `/yt/favorites` 顯示所有收藏

### 資料結構
```javascript
// localStorage key: 'yt-favorites'
{
  favorites: [
    {
      videoId: 'abc123',
      title: '影片標題',
      author: '頻道名稱',
      thumbnail: 'https://...',
      duration: 360, // 秒
      addedAt: 1234567890 // timestamp
    }
  ]
}
```

### UI 設計
- **收藏按鈕位置**：影片標題旁邊
- **收藏頁面**：網格/列表顯示，按收藏時間排序（最新在前）
- **移除收藏**：hover 時顯示移除按鈕

### 相關檔案
- `src/renderer/views/YtWatch/YtWatch.vue` - 加收藏按鈕
- `src/renderer/views/YtFavorites/YtFavorites.vue` - 新建收藏頁面
- `src/renderer/store/modules/favorites.js` - 新建 Vuex module
- `src/renderer/router/index.js` - 加路由

---

## 功能二：課程功能

### 需求
- [ ] 課程頁面 `/yt/courses` 顯示所有課程
- [ ] 建立課程：輸入關鍵字 + 課程名稱
- [ ] 自動搜尋：根據關鍵字搜尋影片
- [ ] 系列整理：同作者 + 標題相似的影片自動分組
- [ ] 課程資料儲存到 localStorage

### 資料結構
```javascript
// localStorage key: 'yt-courses'
{
  courses: [
    {
      id: 'course-uuid',
      name: '課程名稱',
      keyword: '搜尋關鍵字',
      thumbnail: '第一個影片的縮圖',
      createdAt: 1234567890,
      updatedAt: 1234567890,
      videos: [
        {
          videoId: 'abc123',
          title: '影片標題',
          author: '頻道名稱',
          thumbnail: 'https://...',
          duration: 360,
          // 系列分組用
          seriesGroup: 'series-1' // 可選，相同值表示同系列
        }
      ],
      // 系列資訊
      series: [
        {
          id: 'series-1',
          name: '系列名稱（自動偵測）',
          author: '頻道名稱',
          videoIds: ['abc123', 'def456']
        }
      ]
    }
  ]
}
```

### 系列偵測邏輯
```javascript
// 判斷是否為系列影片
function detectSeries(videos) {
  // 1. 按作者分組
  // 2. 同作者的影片，檢查標題相似度
  //    - 標題包含數字序號 (EP.1, #2, 第三集 等)
  //    - 標題前綴相同 (如 "Python教學 - xxx")
  // 3. 相似度 > 70% 視為同系列
}
```

### UI 設計

#### 課程列表頁 `/yt/courses`
- 網格顯示所有課程
- 每個課程卡片：縮圖、名稱、影片數量
- 「建立課程」按鈕

#### 建立課程 Modal
```
┌─────────────────────────────┐
│ 建立新課程                    │
├─────────────────────────────┤
│ 課程名稱: [____________]     │
│ 搜尋關鍵字: [____________]   │
│                             │
│ [取消]         [搜尋並建立]  │
└─────────────────────────────┘
```

#### 課程詳情頁 `/yt/courses/:id`
- 課程名稱、影片數量
- 影片列表（如有系列則分組顯示）
- 「重新整理」按鈕（重新搜尋）
- 「刪除課程」按鈕

### 相關檔案
- `src/renderer/views/YtCourses/YtCourses.vue` - 課程列表頁
- `src/renderer/views/YtCourses/YtCourseDetail.vue` - 課程詳情頁
- `src/renderer/store/modules/courses.js` - 新建 Vuex module
- `src/renderer/helpers/course-utils.js` - 系列偵測等工具函數
- `src/renderer/router/index.js` - 加路由

---

## 開發順序

### Phase 1: 收藏功能
1. 建立 favorites Vuex module
2. YtWatch 加收藏按鈕
3. 建立 YtFavorites 頁面
4. 加路由

### Phase 2: 課程功能
1. 建立 courses Vuex module
2. 建立 YtCourses 列表頁
3. 實作建立課程 Modal + 搜尋
4. 實作系列偵測邏輯
5. 建立 YtCourseDetail 頁面
6. 加路由

---

## 驗收條件

### 收藏功能
- [ ] 可以在影片頁面收藏/取消收藏
- [ ] 收藏頁面正確顯示所有收藏
- [ ] 重新整理後收藏不會消失
- [ ] 可以從收藏頁面移除收藏

### 課程功能
- [ ] 可以建立新課程（輸入關鍵字）
- [ ] 自動搜尋並加入影片
- [ ] 系列影片自動分組
- [ ] 可以查看課程詳情
- [ ] 可以刪除課程
- [ ] 重新整理後課程不會消失
