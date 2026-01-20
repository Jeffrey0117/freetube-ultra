# FreeTube YouTube Cookie 認證功能規格文件

> 版本: 1.0.0
> 日期: 2026-01-20
> 狀態: 草案

---

## 1. 概述

### 1.1 背景問題

FreeTube 目前的搜尋和推薦功能效果不佳，原因是：
- 使用 `youtubei.js` 時沒有傳入用戶認證資訊
- 所有請求都以「匿名用戶」身份進行
- 無法獲得 YouTube 演算法的個人化推薦

### 1.2 解決方案

讓用戶導入 YouTube Cookie，使 FreeTube 能以用戶身份向 YouTube 發送請求，獲得：
- 個人化搜尋結果
- 個人化首頁推薦
- 基於觀看歷史的相關推薦

### 1.3 範圍

| 功能 | 優先級 | 狀態 |
|------|--------|------|
| Cookie 導入設定頁面 | P0 | 待開發 |
| 修改 `createInnertube()` 支援 cookie | P0 | 待開發 |
| Cookie 加密儲存 | P0 | 待開發 |
| Cookie 失效檢測與提示 | P1 | 待開發 |
| Cookie 取得教學 | P2 | 待開發 |

### 1.4 技術基礎

FreeTube 已使用 `youtubei.js` v16.0.1，該庫原生支援 cookie 參數：

```javascript
// youtubei.js 原生支援
const innertube = await Innertube.create({
  cookie: 'YOUR_YOUTUBE_COOKIES_HERE'
});
```

---

## 2. 功能需求

### 2.1 Cookie 導入設定

```
┌─────────────────────────────────────────────────────┐
│  設定 > YouTube 帳戶                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  YouTube Cookie 認證                                │
│  ─────────────────                                  │
│  透過導入 Cookie，獲得個人化搜尋和推薦結果          │
│                                                     │
│  狀態: ○ 未連接 / ● 已連接                          │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │                                             │    │
│  │  請貼上您的 YouTube Cookie：                │    │
│  │  ┌─────────────────────────────────────┐   │    │
│  │  │ (多行文字輸入區)                     │   │    │
│  │  │                                     │   │    │
│  │  │                                     │   │    │
│  │  └─────────────────────────────────────┘   │    │
│  │                                             │    │
│  │  [如何取得 Cookie?]  [驗證並儲存]           │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ⚠️ 注意：Cookie 包含您的登入資訊，請勿分享給他人   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**功能需求：**
- [ ] 多行文字輸入框讓用戶貼上 cookie
- [ ] 「驗證並儲存」按鈕
- [ ] 連接狀態顯示
- [ ] 「清除 Cookie」按鈕（已連接時顯示）
- [ ] Cookie 取得教學連結/彈窗

### 2.2 Cookie 驗證流程

```
驗證流程:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 貼上     │───▶│ 格式驗證 │───▶│ API 測試 │───▶│ 加密儲存 │
│ Cookie   │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │
                     ▼               ▼
                格式錯誤        連線失敗/
                              Cookie 無效
```

**驗證步驟：**
1. 格式檢查（包含必要的 cookie 欄位）
2. 嘗試使用 cookie 建立 Innertube 連線
3. 呼叫簡單 API（如取得帳戶資訊）確認有效
4. 成功則加密儲存，失敗則顯示錯誤訊息

### 2.3 錯誤處理

| 錯誤情況 | 處理方式 |
|----------|----------|
| Cookie 格式錯誤 | 顯示格式提示，引導用戶重新複製 |
| Cookie 已失效 | 提示用戶重新取得 cookie |
| API 請求被拒絕 | 提示可能被 YouTube 限制，建議稍後再試 |
| 網路錯誤 | 提示檢查網路連線 |

**失效檢測時機：**
- 每次搜尋時檢查回應
- 若連續 N 次失敗，提示用戶 cookie 可能已失效

---

## 3. 技術規格

### 3.1 修改 createInnertube()

**檔案：** `src/renderer/helpers/api/local.js`

```javascript
// 現有函數簽名
async function createInnertube({
  withPlayer = false,
  location = undefined,
  safetyMode = false,
  clientType = undefined,
  generateSessionLocally = true
} = {})

// 修改後
async function createInnertube({
  withPlayer = false,
  location = undefined,
  safetyMode = false,
  clientType = undefined,
  generateSessionLocally = true,
  useYouTubeCookie = false  // 新增參數
} = {}) {
  // ... 現有程式碼 ...

  const config = {
    enable_session_cache: false,
    retrieve_innertube_config: !generateSessionLocally,
    user_agent: navigator.userAgent,
    retrieve_player: !!withPlayer,
    location: location,
    enable_safety_mode: !!safetyMode,
    client_type: clientType,
    generate_session_locally: !!generateSessionLocally,
    cache
  }

  // 新增：如果啟用且有儲存的 cookie，則加入
  if (useYouTubeCookie) {
    const cookie = await getStoredYouTubeCookie()
    if (cookie) {
      config.cookie = cookie
    }
  }

  return await Innertube.create(config)
}
```

### 3.2 Cookie 儲存

**儲存位置：** 使用現有的 IndexedDB 機制

**加密方式：** AES-256-GCM（與現有密碼儲存一致）

```javascript
// src/renderer/helpers/youtube-cookie.js

import { encrypt, decrypt } from './crypto'

const COOKIE_STORAGE_KEY = 'youtube_auth_cookie'

/**
 * 儲存 YouTube Cookie（加密）
 */
export async function storeYouTubeCookie(cookie) {
  const encrypted = await encrypt(cookie)
  await DBSettingHandlers.upsert(COOKIE_STORAGE_KEY, encrypted)
}

/**
 * 取得已儲存的 YouTube Cookie（解密）
 */
export async function getStoredYouTubeCookie() {
  const encrypted = await DBSettingHandlers.find(COOKIE_STORAGE_KEY)
  if (!encrypted) return null
  return await decrypt(encrypted)
}

/**
 * 清除 YouTube Cookie
 */
export async function clearYouTubeCookie() {
  await DBSettingHandlers.delete(COOKIE_STORAGE_KEY)
}

/**
 * 驗證 Cookie 是否有效
 */
export async function validateYouTubeCookie(cookie) {
  try {
    const innertube = await Innertube.create({
      cookie,
      enable_session_cache: false
    })

    // 嘗試取得帳戶資訊來驗證
    const accountInfo = await innertube.account.getInfo()

    return {
      valid: true,
      accountName: accountInfo?.name || 'Unknown'
    }
  } catch (error) {
    return {
      valid: false,
      error: error.message
    }
  }
}
```

### 3.3 資料模型

```javascript
// settings.db 新增欄位
{
  _id: 'youtube_auth_cookie',
  value: 'encrypted_cookie_string',
  updatedAt: timestamp
}

// 或使用獨立的 youtube-auth.db
{
  _id: 'youtube_auth',
  cookie: 'encrypted_cookie_string',  // 加密的 cookie
  isEnabled: boolean,                  // 是否啟用
  lastValidated: timestamp,            // 最後驗證時間
  accountName: string,                 // YouTube 帳戶名稱（顯示用）
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 3.4 Vuex Store 擴展

**檔案：** `src/renderer/store/modules/settings.js`（或新建 `youtube-auth.js`）

```javascript
// state
const state = {
  // ... 現有 state ...
  youtubeAuth: {
    isEnabled: false,
    isConnected: false,
    accountName: null,
    lastValidated: null
  }
}

// getters
const getters = {
  isYouTubeAuthEnabled: state => state.youtubeAuth.isEnabled,
  isYouTubeConnected: state => state.youtubeAuth.isConnected,
  youtubeAccountName: state => state.youtubeAuth.accountName
}

// actions
const actions = {
  async setYouTubeCookie({ commit }, cookie) {
    const validation = await validateYouTubeCookie(cookie)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    await storeYouTubeCookie(cookie)
    commit('SET_YOUTUBE_AUTH', {
      isEnabled: true,
      isConnected: true,
      accountName: validation.accountName,
      lastValidated: Date.now()
    })
  },

  async clearYouTubeCookie({ commit }) {
    await clearYouTubeCookie()
    commit('SET_YOUTUBE_AUTH', {
      isEnabled: false,
      isConnected: false,
      accountName: null,
      lastValidated: null
    })
  },

  async loadYouTubeAuthStatus({ commit }) {
    const cookie = await getStoredYouTubeCookie()
    if (cookie) {
      const validation = await validateYouTubeCookie(cookie)
      commit('SET_YOUTUBE_AUTH', {
        isEnabled: true,
        isConnected: validation.valid,
        accountName: validation.valid ? validation.accountName : null,
        lastValidated: Date.now()
      })
    }
  }
}

// mutations
const mutations = {
  SET_YOUTUBE_AUTH(state, authData) {
    state.youtubeAuth = { ...state.youtubeAuth, ...authData }
  }
}
```

### 3.5 必要的 Cookie 欄位

YouTube Cookie 中重要的欄位：

| Cookie 名稱 | 用途 |
|------------|------|
| `SID` | Session ID |
| `HSID` | 安全 Session ID |
| `SSID` | 安全 Session ID |
| `APISID` | API Session ID |
| `SAPISID` | 安全 API Session ID |
| `__Secure-1PSID` | 第一方安全 Session |
| `__Secure-3PSID` | 第三方安全 Session |
| `LOGIN_INFO` | 登入資訊 |

**格式驗證：**
```javascript
function validateCookieFormat(cookieString) {
  const requiredCookies = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID']
  const cookies = parseCookieString(cookieString)

  const missing = requiredCookies.filter(name => !cookies[name])

  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必要的 Cookie: ${missing.join(', ')}`
    }
  }

  return { valid: true }
}
```

---

## 4. UI/UX 設計

### 4.1 設定頁面位置

```
設定
├── 一般
├── 主題
├── 播放器
├── ...
├── 隱私設定
├── YouTube 帳戶    ← 新增
└── 進階
```

### 4.2 元件結構

```
components/
├── ft-youtube-auth/
│   ├── FtYouTubeAuth.vue           # 主元件
│   ├── FtYouTubeCookieInput.vue    # Cookie 輸入框
│   ├── FtYouTubeAuthStatus.vue     # 連線狀態顯示
│   └── FtYouTubeCookieHelp.vue     # Cookie 取得教學
```

### 4.3 Cookie 取得教學內容

```
如何取得 YouTube Cookie
────────────────────────

1. 在瀏覽器中登入 YouTube (youtube.com)

2. 開啟開發者工具
   - Windows/Linux: 按 F12 或 Ctrl+Shift+I
   - macOS: 按 Cmd+Option+I

3. 切換到「應用程式」或「Application」分頁

4. 在左側選擇「Cookies」>「https://www.youtube.com」

5. 全選所有 Cookie（Ctrl+A）並複製

6. 貼到上方的輸入框中

[顯示截圖/動畫說明]
```

---

## 5. 安全考量

### 5.1 Cookie 保護

- Cookie 使用 AES-256-GCM 加密後儲存
- 金鑰由本機產生並安全儲存
- Cookie 不會傳送到任何第三方伺服器
- 提供一鍵清除功能

### 5.2 隱私提示

在設定頁面顯示警告：

```
⚠️ 安全提示

1. Cookie 包含您的 YouTube 登入資訊
2. 請勿將 Cookie 分享給任何人
3. FreeTube 只會將 Cookie 用於向 YouTube 發送請求
4. Cookie 會加密儲存在您的裝置上
5. 您可以隨時清除已儲存的 Cookie
```

### 5.3 風險說明

| 風險 | 說明 | 緩解措施 |
|------|------|----------|
| Cookie 洩露 | 若他人取得 cookie 可存取帳戶 | 加密儲存、提醒用戶 |
| 帳戶被封鎖 | YouTube 可能偵測異常存取 | 使用合理的請求頻率 |
| Cookie 失效 | Cookie 有期限 | 定期檢測、提示更新 |

---

## 6. 錯誤處理與日誌

### 6.1 錯誤代碼

| 代碼 | 名稱 | 說明 |
|------|------|------|
| YT_AUTH_001 | COOKIE_FORMAT_INVALID | Cookie 格式錯誤 |
| YT_AUTH_002 | COOKIE_MISSING_FIELDS | 缺少必要的 Cookie 欄位 |
| YT_AUTH_003 | COOKIE_EXPIRED | Cookie 已失效 |
| YT_AUTH_004 | API_REQUEST_FAILED | API 請求失敗 |
| YT_AUTH_005 | ENCRYPTION_FAILED | 加密失敗 |
| YT_AUTH_006 | DECRYPTION_FAILED | 解密失敗 |

### 6.2 日誌記錄

```javascript
// 記錄格式（不記錄敏感資訊）
{
  timestamp: '2026-01-20T12:00:00Z',
  event: 'youtube_auth_attempt',
  success: true/false,
  errorCode: 'YT_AUTH_XXX' // 僅失敗時
}
```

---

## 7. 實作計畫

### 7.1 任務分解

```
Phase 1: 核心功能
├── [ ] 建立 youtube-cookie.js helper
├── [ ] 修改 createInnertube() 支援 cookie
├── [ ] 實作 Cookie 加密/解密
├── [ ] 實作 Cookie 驗證邏輯
└── [ ] 新增 Vuex youtube-auth 模組

Phase 2: UI 開發
├── [ ] FtYouTubeAuth 主元件
├── [ ] FtYouTubeCookieInput 輸入元件
├── [ ] FtYouTubeAuthStatus 狀態元件
├── [ ] 設定頁面整合
└── [ ] Cookie 取得教學彈窗

Phase 3: 整合與測試
├── [ ] 搜尋功能整合
├── [ ] 首頁推薦整合
├── [ ] 錯誤處理完善
├── [ ] 單元測試
└── [ ] 使用者測試
```

---

## 8. 未來擴展

### 8.1 可能的後續功能

- [ ] OAuth2 登入流程（更安全但實作複雜）
- [ ] 瀏覽器擴充套件自動同步 cookie
- [ ] 多帳戶支援
- [ ] Cookie 自動刷新

### 8.2 字幕翻譯功能（另案處理）

> 備註：用戶另有字幕翻譯功能需求，將另建規格文件處理。

---

## 9. 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0.0 | 2026-01-20 | 初始版本 |

---

## 10. 參考資料

- [youtubei.js 官方文檔](https://ytjs.dev/)
- [FreeTube 現有 API 實作](../src/renderer/helpers/api/local.js)
- [InnerTube Session Options](https://www.ytjs.dev/api/types/SessionOptions)
