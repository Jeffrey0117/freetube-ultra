# FreeTube Web 會員個人檔案系統規格文件

> 版本: 1.0.0
> 日期: 2026-01-01
> 狀態: 草案

---

## 1. 概述

### 1.1 目標

建立一個完整的會員個人檔案系統，讓用戶可以：
- 建立和管理個人帳戶
- 跨裝置同步訂閱、播放清單、觀看歷史
- 自訂個人偏好設定
- 社交功能（可選）

### 1.2 範圍

| 階段 | 功能 | 優先級 |
|------|------|--------|
| Phase 1 | 本地會員系統 | P0 |
| Phase 2 | 雲端同步 | P1 |
| Phase 3 | 社交功能 | P2 |

### 1.3 現有系統整合

FreeTube 現有以下可復用的系統：

```
現有模組                    新系統整合方式
─────────────────────────────────────────────
profiles.js     →    會員的訂閱配置
settings.js     →    會員偏好設定
history.js      →    會員觀看歷史
playlists.js    →    會員播放清單
onboarding.js   →    會員註冊流程
invidious.js    →    認證機制參考
```

---

## 2. 功能需求

### 2.1 Phase 1: 本地會員系統

#### 2.1.1 會員註冊/登入

```
┌─────────────────────────────────────┐
│         FreeTube 會員系統           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │      建立新帳戶              │    │
│  │  ─────────────────────────  │    │
│  │  用戶名稱: [____________]   │    │
│  │  密碼:     [____________]   │    │
│  │  確認密碼: [____________]   │    │
│  │                             │    │
│  │  [ ] 記住我                 │    │
│  │                             │    │
│  │  [建立帳戶]  [訪客模式]     │    │
│  └─────────────────────────────┘    │
│                                     │
│  已有帳戶？ 切換帳戶               │
└─────────────────────────────────────┘
```

**功能需求：**
- [ ] 本地帳戶建立（用戶名 + 密碼）
- [ ] 密碼加密儲存（bcrypt/argon2）
- [ ] 多帳戶切換
- [ ] 訪客模式（不建立帳戶）
- [ ] 自動登入選項

#### 2.1.2 個人檔案頁面

```
┌─────────────────────────────────────────────────────┐
│  [← 返回]              我的個人檔案                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────┐   用戶名稱                               │
│  │ 頭像 │   @username                              │
│  │      │   加入日期: 2026-01-01                   │
│  └──────┘   [編輯個人檔案]                         │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────┬─────────┬─────────┬─────────┐         │
│  │ 訂閱    │ 播放清單 │ 歷史    │ 設定    │         │
│  │  127    │    23    │  1,024  │         │         │
│  └─────────┴─────────┴─────────┴─────────┘         │
│                                                     │
│  ═══════════════════════════════════════════        │
│                                                     │
│  統計數據                                           │
│  ─────────                                          │
│  總觀看時間: 156 小時                               │
│  最常看的頻道: @ChannelName                        │
│  最愛的分類: 音樂, 科技                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**功能需求：**
- [ ] 頭像上傳/選擇
- [ ] 用戶名稱編輯
- [ ] 統計數據顯示
- [ ] Tab 切換（訂閱/播放清單/歷史/設定）

#### 2.1.3 帳戶設定

| 設定項目 | 類型 | 預設值 | 說明 |
|----------|------|--------|------|
| `username` | string | - | 用戶名稱（唯一） |
| `displayName` | string | - | 顯示名稱 |
| `avatar` | string | default | 頭像 URL 或預設圖 |
| `email` | string | null | 可選，用於雲端同步 |
| `createdAt` | timestamp | - | 建立時間 |
| `lastLoginAt` | timestamp | - | 最後登入時間 |
| `preferences` | object | {} | 個人偏好設定 |

### 2.2 Phase 2: 雲端同步

#### 2.2.1 同步架構

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Device A  │     │  Sync API   │     │   Device B  │
│  (Desktop)  │────▶│  (Server)   │◀────│   (Mobile)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
  ┌─────────┐        ┌─────────┐        ┌─────────┐
  │ NeDB    │        │ MongoDB │        │ NeDB    │
  │ (Local) │        │ (Cloud) │        │ (Local) │
  └─────────┘        └─────────┘        └─────────┘
```

#### 2.2.2 同步資料類型

| 資料類型 | 同步策略 | 衝突解決 |
|----------|----------|----------|
| 訂閱 | 即時同步 | 合併（取聯集） |
| 播放清單 | 即時同步 | 時間戳優先 |
| 觀看歷史 | 批次同步 | 合併 + 去重 |
| 設定 | 即時同步 | 最新優先 |
| 觀看進度 | 即時同步 | 最大進度優先 |

#### 2.2.3 API 端點設計

```yaml
# 認證
POST   /api/v1/auth/register     # 註冊
POST   /api/v1/auth/login        # 登入
POST   /api/v1/auth/logout       # 登出
POST   /api/v1/auth/refresh      # 刷新 Token
DELETE /api/v1/auth/account      # 刪除帳戶

# 個人檔案
GET    /api/v1/profile           # 取得個人檔案
PUT    /api/v1/profile           # 更新個人檔案
POST   /api/v1/profile/avatar    # 上傳頭像

# 同步
GET    /api/v1/sync/status       # 同步狀態
POST   /api/v1/sync/push         # 推送本地變更
POST   /api/v1/sync/pull         # 拉取雲端變更
POST   /api/v1/sync/full         # 完整同步

# 訂閱
GET    /api/v1/subscriptions     # 取得訂閱列表
POST   /api/v1/subscriptions     # 新增訂閱
DELETE /api/v1/subscriptions/:id # 取消訂閱

# 播放清單
GET    /api/v1/playlists         # 取得播放清單
POST   /api/v1/playlists         # 建立播放清單
PUT    /api/v1/playlists/:id     # 更新播放清單
DELETE /api/v1/playlists/:id     # 刪除播放清單

# 歷史記錄
GET    /api/v1/history           # 取得歷史記錄
POST   /api/v1/history/batch     # 批次上傳歷史
DELETE /api/v1/history           # 清除歷史
```

### 2.3 Phase 3: 社交功能（可選）

- [ ] 公開個人檔案
- [ ] 分享播放清單
- [ ] 追蹤其他用戶
- [ ] 播放清單協作

---

## 3. 技術規格

### 3.1 資料模型

#### 3.1.1 User（用戶）

```javascript
// users.db
{
  _id: 'user-{uuid}',
  username: 'string',           // 唯一，3-20 字元
  displayName: 'string',        // 顯示名稱
  passwordHash: 'string',       // bcrypt hash
  avatar: 'string',             // URL 或 base64
  email: 'string|null',         // 可選

  // 時間戳
  createdAt: timestamp,
  lastLoginAt: timestamp,
  lastSyncAt: timestamp,

  // 同步設定
  sync: {
    enabled: boolean,
    token: 'string|null',       // JWT refresh token
    deviceId: 'string',
    lastPushAt: timestamp,
    lastPullAt: timestamp
  },

  // 統計數據
  stats: {
    totalWatchTime: number,     // 秒
    videosWatched: number,
    subscriptionCount: number,
    playlistCount: number
  },

  // 偏好設定（覆蓋全域設定）
  preferences: {
    theme: 'string|null',
    language: 'string|null',
    defaultQuality: 'string|null',
    // ... 其他可覆蓋的設定
  }
}
```

#### 3.1.2 Session（會話）

```javascript
// sessions.db
{
  _id: 'session-{uuid}',
  userId: 'user-{uuid}',
  token: 'string',              // JWT access token
  deviceInfo: {
    platform: 'string',
    userAgent: 'string',
    ip: 'string'
  },
  createdAt: timestamp,
  expiresAt: timestamp,
  isActive: boolean
}
```

#### 3.1.3 關聯資料結構變更

```javascript
// 現有資料表新增 userId 欄位

// profiles.db
{
  _id: 'profile-{uuid}',
  userId: 'user-{uuid}',        // 新增：關聯用戶
  name: 'string',
  // ... 現有欄位
}

// history.db
{
  _id: '{videoId}-{userId}',    // 修改：包含 userId
  userId: 'user-{uuid}',        // 新增：關聯用戶
  videoId: 'string',
  // ... 現有欄位
}

// playlists.db
{
  _id: 'playlist-{uuid}',
  userId: 'user-{uuid}',        // 新增：關聯用戶
  // ... 現有欄位
}
```

### 3.2 Vuex Store 設計

```javascript
// store/modules/user.js

const state = {
  // 當前用戶
  currentUser: null,
  isAuthenticated: false,
  isLoading: false,

  // 會話
  session: {
    token: null,
    expiresAt: null
  },

  // 同步狀態
  syncStatus: {
    isSyncing: false,
    lastSyncAt: null,
    pendingChanges: 0,
    error: null
  },

  // 所有本地用戶
  localUsers: []
}

const getters = {
  isLoggedIn: state => state.isAuthenticated,
  currentUserId: state => state.currentUser?._id,
  currentUsername: state => state.currentUser?.username,
  userPreferences: state => state.currentUser?.preferences || {},
  hasPendingSync: state => state.syncStatus.pendingChanges > 0
}

const actions = {
  // 認證
  async register({ commit }, { username, password }),
  async login({ commit }, { username, password }),
  async logout({ commit }),
  async switchUser({ commit }, userId),

  // 個人檔案
  async updateProfile({ commit }, profileData),
  async uploadAvatar({ commit }, file),
  async deleteAccount({ commit }),

  // 同步
  async syncNow({ commit }),
  async enableSync({ commit }, { email, password }),
  async disableSync({ commit }),

  // 初始化
  async initializeUser({ commit }),
  async loadLocalUsers({ commit })
}

const mutations = {
  SET_USER(state, user),
  SET_AUTHENTICATED(state, isAuthenticated),
  SET_SESSION(state, session),
  SET_SYNC_STATUS(state, status),
  SET_LOCAL_USERS(state, users),
  UPDATE_USER_STATS(state, stats)
}
```

### 3.3 認證流程

#### 3.3.1 本地認證

```
┌─────────────────────────────────────────────────────┐
│                    本地認證流程                      │
└─────────────────────────────────────────────────────┘

註冊流程:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 輸入資訊 │───▶│ 驗證格式 │───▶│ 建立用戶 │───▶│ 自動登入 │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │
                     ▼ (失敗)
               顯示錯誤訊息

登入流程:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 輸入帳密 │───▶│ 查詢用戶 │───▶│ 驗證密碼 │───▶│ 建立會話 │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │
                     ▼               ▼
                用戶不存在      密碼錯誤
```

#### 3.3.2 JWT Token 結構

```javascript
// Access Token (短期, 1 小時)
{
  header: { alg: 'HS256', typ: 'JWT' },
  payload: {
    sub: 'user-{uuid}',
    username: 'string',
    iat: timestamp,
    exp: timestamp,
    type: 'access'
  }
}

// Refresh Token (長期, 30 天)
{
  header: { alg: 'HS256', typ: 'JWT' },
  payload: {
    sub: 'user-{uuid}',
    deviceId: 'string',
    iat: timestamp,
    exp: timestamp,
    type: 'refresh'
  }
}
```

### 3.4 同步機制

#### 3.4.1 變更追蹤

```javascript
// sync-queue.db - 待同步變更佇列
{
  _id: 'change-{uuid}',
  userId: 'user-{uuid}',
  entityType: 'subscription|playlist|history|settings',
  entityId: 'string',
  action: 'create|update|delete',
  data: { /* 變更資料 */ },
  timestamp: timestamp,
  retryCount: number,
  status: 'pending|syncing|synced|failed'
}
```

#### 3.4.2 同步演算法

```
同步流程:
1. 檢查網路連線
2. 驗證 Token 有效性
3. 取得本地待同步變更
4. 推送變更到伺服器
5. 拉取伺服器變更
6. 解決衝突
7. 套用變更到本地
8. 更新同步狀態

衝突解決策略:
- 訂閱: 合併（兩端都有 = 保留，任一端刪除 = 刪除）
- 播放清單: 最後修改時間優先
- 歷史: 合併 + 取最大觀看進度
- 設定: 最後修改時間優先
```

### 3.5 安全考量

#### 3.5.1 密碼安全

```javascript
// 密碼要求
const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: false,  // 建議但不強制
  requireLowercase: false,
  requireNumber: false,
  requireSpecial: false
}

// 密碼雜湊
const bcrypt = require('bcrypt')
const SALT_ROUNDS = 12

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}
```

#### 3.5.2 Token 安全

```javascript
// Token 設定
const TOKEN_CONFIG = {
  accessToken: {
    expiresIn: '1h',
    secret: process.env.JWT_ACCESS_SECRET
  },
  refreshToken: {
    expiresIn: '30d',
    secret: process.env.JWT_REFRESH_SECRET
  }
}

// Token 儲存
// - Access Token: 記憶體（Vuex state）
// - Refresh Token: 加密儲存（NeDB）
```

#### 3.5.3 資料加密

```javascript
// 敏感資料加密（可選）
const ENCRYPTION = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000
}

// 加密欄位
const ENCRYPTED_FIELDS = [
  'user.email',
  'user.sync.token'
]
```

---

## 4. UI/UX 設計

### 4.1 頁面路由

```javascript
// router/index.js 新增路由
const userRoutes = [
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } },
  { path: '/profile/edit', component: ProfileEdit, meta: { requiresAuth: true } },
  { path: '/profile/settings', component: ProfileSettings, meta: { requiresAuth: true } },
  { path: '/profile/sync', component: SyncSettings, meta: { requiresAuth: true } },
  { path: '/switch-user', component: SwitchUser }
]
```

### 4.2 元件結構

```
components/
├── ft-user/
│   ├── FtUserAvatar.vue         # 用戶頭像
│   ├── FtUserMenu.vue           # 用戶選單（右上角）
│   ├── FtUserStats.vue          # 用戶統計
│   └── FtUserBadge.vue          # 用戶徽章
│
├── ft-auth/
│   ├── FtLoginForm.vue          # 登入表單
│   ├── FtRegisterForm.vue       # 註冊表單
│   ├── FtPasswordInput.vue      # 密碼輸入（顯示/隱藏）
│   └── FtAuthGuard.vue          # 路由守衛元件
│
├── ft-sync/
│   ├── FtSyncStatus.vue         # 同步狀態指示器
│   ├── FtSyncSettings.vue       # 同步設定
│   └── FtSyncConflict.vue       # 衝突解決對話框
│
views/
├── Login/
│   └── Login.vue
├── Register/
│   └── Register.vue
├── Profile/
│   ├── Profile.vue              # 主頁面
│   ├── ProfileEdit.vue          # 編輯頁面
│   └── ProfileSettings.vue      # 設定頁面
└── SwitchUser/
    └── SwitchUser.vue           # 切換用戶頁面
```

### 4.3 用戶選單設計

```
┌──────────────────────┐
│  ┌────┐              │
│  │頭像│  用戶名稱     │
│  └────┘  @username   │
├──────────────────────┤
│  👤 我的個人檔案     │
│  ⚙️ 帳戶設定         │
│  🔄 同步狀態  ●在線  │
├──────────────────────┤
│  🔀 切換帳戶         │
│  🚪 登出             │
└──────────────────────┘
```

### 4.4 同步狀態指示器

```
狀態圖示:
● 綠色 - 已同步
● 黃色 - 同步中
● 紅色 - 同步失敗
○ 灰色 - 離線/未啟用

狀態列顯示:
┌─────────────────────────────────────┐
│ 🔄 同步中... (3/10)                 │
│ ████████░░░░░░░░░░░░ 30%           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ✓ 已同步                            │
│ 最後同步: 2 分鐘前                  │
└─────────────────────────────────────┘
```

---

## 5. 實作計畫

### 5.1 Phase 1 任務分解

```
Week 1-2: 基礎架構
├── [ ] 建立 users.db 資料表
├── [ ] 建立 sessions.db 資料表
├── [ ] 實作 Vuex user 模組
├── [ ] 實作密碼雜湊工具
└── [ ] 建立認證 API 端點

Week 3-4: UI 開發
├── [ ] FtLoginForm 元件
├── [ ] FtRegisterForm 元件
├── [ ] Login/Register 頁面
├── [ ] Profile 頁面
└── [ ] FtUserMenu 元件

Week 5-6: 整合與測試
├── [ ] 路由守衛實作
├── [ ] 現有資料關聯用戶
├── [ ] 多帳戶切換功能
├── [ ] 單元測試
└── [ ] 整合測試
```

### 5.2 Phase 2 任務分解

```
Week 7-8: 同步後端
├── [ ] 同步 API 伺服器設計
├── [ ] MongoDB 資料模型
├── [ ] JWT 認證中間件
├── [ ] 同步端點實作
└── [ ] 衝突解決邏輯

Week 9-10: 同步前端
├── [ ] sync-queue.db 資料表
├── [ ] 變更追蹤機制
├── [ ] 同步服務實作
├── [ ] FtSyncStatus 元件
└── [ ] FtSyncSettings 頁面

Week 11-12: 整合與優化
├── [ ] 離線支援
├── [ ] 同步衝突 UI
├── [ ] 效能優化
├── [ ] 端對端測試
└── [ ] 文件更新
```

---

## 6. 測試計畫

### 6.1 單元測試

```javascript
// tests/user.test.js
describe('User Module', () => {
  describe('Registration', () => {
    test('should create user with valid data')
    test('should reject duplicate username')
    test('should hash password correctly')
    test('should validate username format')
  })

  describe('Authentication', () => {
    test('should login with correct credentials')
    test('should reject invalid password')
    test('should create session on login')
    test('should destroy session on logout')
  })

  describe('Profile', () => {
    test('should update display name')
    test('should update avatar')
    test('should update preferences')
  })
})
```

### 6.2 整合測試

```javascript
// tests/user-integration.test.js
describe('User Integration', () => {
  test('full registration flow')
  test('login and access protected route')
  test('switch between users')
  test('data isolation between users')
})
```

### 6.3 E2E 測試

```javascript
// tests/e2e/user.spec.js
describe('User E2E', () => {
  test('user can register and login')
  test('user can edit profile')
  test('user can switch accounts')
  test('sync status updates correctly')
})
```

---

## 7. 附錄

### 7.1 錯誤代碼

| 代碼 | 名稱 | 說明 |
|------|------|------|
| USER_001 | USERNAME_TAKEN | 用戶名已被使用 |
| USER_002 | INVALID_USERNAME | 用戶名格式錯誤 |
| USER_003 | INVALID_PASSWORD | 密碼不符合要求 |
| USER_004 | USER_NOT_FOUND | 用戶不存在 |
| USER_005 | WRONG_PASSWORD | 密碼錯誤 |
| AUTH_001 | TOKEN_EXPIRED | Token 已過期 |
| AUTH_002 | TOKEN_INVALID | Token 無效 |
| AUTH_003 | SESSION_EXPIRED | 會話已過期 |
| SYNC_001 | SYNC_FAILED | 同步失敗 |
| SYNC_002 | CONFLICT_DETECTED | 偵測到衝突 |
| SYNC_003 | NETWORK_ERROR | 網路錯誤 |

### 7.2 設定項目

```javascript
// config/user.config.js
module.exports = {
  // 用戶名規則
  username: {
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_-]+$/,
    reserved: ['admin', 'system', 'root', 'guest']
  },

  // 密碼規則
  password: {
    minLength: 8,
    maxLength: 128
  },

  // 會話設定
  session: {
    accessTokenExpiry: '1h',
    refreshTokenExpiry: '30d',
    maxSessions: 5
  },

  // 同步設定
  sync: {
    batchSize: 100,
    retryAttempts: 3,
    retryDelay: 5000
  }
}
```

### 7.3 遷移腳本

```javascript
// migrations/001_add_user_id.js
/**
 * 為現有資料添加 userId 欄位
 * 將所有現有資料歸屬於預設用戶
 */
async function migrate(db) {
  const DEFAULT_USER_ID = 'user-default'

  // 建立預設用戶
  await db.users.insert({
    _id: DEFAULT_USER_ID,
    username: 'default',
    displayName: 'Default User',
    createdAt: Date.now()
  })

  // 更新現有資料
  await db.profiles.update({}, { $set: { userId: DEFAULT_USER_ID } }, { multi: true })
  await db.history.update({}, { $set: { userId: DEFAULT_USER_ID } }, { multi: true })
  await db.playlists.update({}, { $set: { userId: DEFAULT_USER_ID } }, { multi: true })
}
```

---

## 8. 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0.0 | 2026-01-01 | 初始版本 |

---

## 9. 參考資料

- [現有 Profile 系統](../src/renderer/store/modules/profiles.js)
- [NeDB 資料庫](../src/datastores/handlers/base.js)
- [Onboarding 系統](../src/renderer/store/modules/onboarding.js)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc7519)
