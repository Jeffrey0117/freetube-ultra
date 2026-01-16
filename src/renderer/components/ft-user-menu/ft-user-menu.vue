<template>
  <div
    ref="menuContainer"
    class="ft-user-menu"
    :class="{ 'menu-open': isMenuOpen }"
  >
    <!-- 未登入狀態：顯示登入按鈕 -->
    <button
      v-if="!isLoggedIn"
      class="login-button"
      :title="$t('User.Login')"
      @click="navigateToLogin"
    >
      <font-awesome-icon
        :icon="['fas', 'user']"
        class="login-icon"
      />
      <span class="login-text">{{ $t('User.Login') }}</span>
    </button>

    <!-- 已登入狀態：顯示頭像和下拉選單 -->
    <div
      v-else
      class="user-menu-trigger"
    >
      <!-- 觸發按鈕：頭像 + 用戶名 -->
      <button
        class="menu-trigger-button"
        :title="currentUser.displayName || currentUser.username"
        @click="toggleMenu"
      >
        <ft-user-avatar
          :src="currentUser.avatar"
          :alt="currentUser.displayName || currentUser.username"
          size="small"
          :show-status="syncEnabled"
          :status="syncStatus"
        />
        <span class="user-name">{{ truncatedName }}</span>
        <font-awesome-icon
          :icon="['fas', isMenuOpen ? 'chevron-up' : 'chevron-down']"
          class="menu-arrow"
        />
      </button>

      <!-- 下拉選單 -->
      <transition name="menu-fade">
        <div
          v-show="isMenuOpen"
          class="dropdown-menu"
        >
          <!-- 用戶資訊頭部 -->
          <div class="menu-header">
            <ft-user-avatar
              :src="currentUser.avatar"
              :alt="currentUser.displayName || currentUser.username"
              size="medium"
            />
            <div class="header-info">
              <span class="header-name">{{ currentUser.displayName || currentUser.username }}</span>
              <span class="header-username">@{{ currentUser.username }}</span>
            </div>
          </div>

          <div class="menu-divider" />

          <!-- 選單項目 -->
          <ul class="menu-list">
            <!-- 我的個人檔案 -->
            <li class="menu-item">
              <button
                class="menu-item-button"
                @click="navigateToProfile"
              >
                <font-awesome-icon
                  :icon="['fas', 'user-circle']"
                  class="menu-item-icon"
                />
                <span>{{ $t('User.My Profile') }}</span>
              </button>
            </li>

            <!-- 帳戶設定 -->
            <li class="menu-item">
              <button
                class="menu-item-button"
                @click="navigateToSettings"
              >
                <font-awesome-icon
                  :icon="['fas', 'cog']"
                  class="menu-item-icon"
                />
                <span>{{ $t('User.Account Settings') }}</span>
              </button>
            </li>

            <!-- 同步狀態 -->
            <li
              v-if="syncEnabled"
              class="menu-item"
            >
              <button
                class="menu-item-button"
                @click="handleSync"
              >
                <font-awesome-icon
                  :icon="['fas', 'sync-alt']"
                  class="menu-item-icon"
                  :class="{ 'fa-spin': isSyncing }"
                />
                <span>{{ syncStatusText }}</span>
                <span
                  class="sync-indicator"
                  :class="syncIndicatorClass"
                />
              </button>
            </li>

            <div class="menu-divider" />

            <!-- 切換帳戶 -->
            <li
              v-if="hasMultipleUsers"
              class="menu-item"
            >
              <button
                class="menu-item-button"
                @click="navigateToSwitchUser"
              >
                <font-awesome-icon
                  :icon="['fas', 'exchange-alt']"
                  class="menu-item-icon"
                />
                <span>{{ $t('User.Switch Account') }}</span>
              </button>
            </li>

            <!-- 登出 -->
            <li class="menu-item">
              <button
                class="menu-item-button logout-button"
                @click="handleLogout"
              >
                <font-awesome-icon
                  :icon="['fas', 'sign-out-alt']"
                  class="menu-item-icon"
                />
                <span>{{ $t('User.Logout') }}</span>
              </button>
            </li>
          </ul>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
/**
 * FtUserMenu - 用戶選單元件
 *
 * 右上角的用戶選單下拉元件：
 * - 未登入：顯示登入按鈕
 * - 已登入：顯示頭像 + 用戶名，點擊展開下拉選單
 *
 * 下拉選單內容：
 * - 我的個人檔案
 * - 帳戶設定
 * - 同步狀態（如果啟用）
 * - 切換帳戶（如果有多個帳戶）
 * - 登出
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { useI18n } from '../../composables/use-i18n-polyfill'
import FtUserAvatar from '../ft-user-avatar/ft-user-avatar.vue'

const router = useRouter()
const store = useStore()
const { t } = useI18n()

// 元件引用
const menuContainer = ref(null)

// 響應式狀態
const isMenuOpen = ref(false)

// 計算屬性：是否已登入
const isLoggedIn = computed(() => {
  return store.getters['user/isLoggedIn'] || false
})

// 計算屬性：當前用戶
const currentUser = computed(() => {
  return store.getters['user/currentUser'] || {
    username: 'Guest',
    displayName: '',
    avatar: ''
  }
})

// 計算屬性：截斷的用戶名（最多 15 字元）
const truncatedName = computed(() => {
  const name = currentUser.value.displayName || currentUser.value.username
  if (name.length > 15) {
    return name.substring(0, 15) + '...'
  }
  return name
})

// 計算屬性：是否有多個用戶帳戶
const hasMultipleUsers = computed(() => {
  const users = store.getters['user/localUsers'] || []
  return users.length > 1
})

// 計算屬性：是否啟用同步
const syncEnabled = computed(() => {
  return store.getters['user/syncEnabled'] || false
})

// 計算屬性：是否正在同步
const isSyncing = computed(() => {
  return store.getters['user/isSyncing'] || false
})

// 計算屬性：同步狀態
const syncStatus = computed(() => {
  if (isSyncing.value) return 'syncing'
  if (store.getters['user/hasSyncError']) return 'offline'
  return 'online'
})

// 計算屬性：同步狀態文字
const syncStatusText = computed(() => {
  if (isSyncing.value) return t('User.Syncing')
  if (store.getters['user/hasSyncError']) return t('User.Sync Failed')
  return t('User.Synced')
})

// 計算屬性：同步指示器類別
const syncIndicatorClass = computed(() => {
  return `sync-${syncStatus.value}`
})

// 切換選單開關
function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

// 關閉選單
function closeMenu() {
  isMenuOpen.value = false
}

// 點擊外部關閉選單
function handleClickOutside(event) {
  if (menuContainer.value && !menuContainer.value.contains(event.target)) {
    closeMenu()
  }
}

// 導航到登入頁面
function navigateToLogin() {
  router.push('/login')
  closeMenu()
}

// 導航到個人檔案
function navigateToProfile() {
  router.push('/profile')
  closeMenu()
}

// 導航到帳戶設定
function navigateToSettings() {
  router.push('/settings/profile')
  closeMenu()
}

// 導航到切換帳戶頁面
function navigateToSwitchUser() {
  router.push('/switch-user')
  closeMenu()
}

// 處理同步
function handleSync() {
  store.dispatch('user/syncNow')
}

// 處理登出
async function handleLogout() {
  try {
    await store.dispatch('user/logout')
    router.push('/')
  } catch (error) {
    console.error('Logout failed:', error)
  }
  closeMenu()
}

// 生命週期：掛載時添加點擊外部事件監聽
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

// 生命週期：卸載時移除事件監聽
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* 選單容器 */
.ft-user-menu {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* 登入按鈕（未登入狀態） */
.login-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 20px;
  background-color: var(--primary-color);
  color: var(--text-with-main-color);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.15s ease;
}

.login-button:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.login-button:active {
  transform: translateY(0);
}

.login-icon {
  font-size: 14px;
}

/* 選單觸發按鈕 */
.menu-trigger-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border: none;
  border-radius: 24px;
  background-color: var(--secondary-card-bg-color);
  color: var(--primary-text-color);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-trigger-button:hover {
  background-color: var(--scrollbar-color);
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-arrow {
  font-size: 10px;
  color: var(--secondary-text-color);
  transition: transform 0.2s ease;
}

.menu-open .menu-arrow {
  transform: rotate(180deg);
}

/* 下拉選單 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 280px;
  background-color: var(--card-bg-color);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  z-index: 1000;
  overflow: hidden;
}

/* 選單動畫 */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 選單頭部 */
.menu-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: var(--secondary-card-bg-color);
}

.header-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.header-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-username {
  font-size: 13px;
  color: var(--secondary-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 分隔線 */
.menu-divider {
  height: 1px;
  background-color: var(--scrollbar-color);
  margin: 0;
}

/* 選單列表 */
.menu-list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
}

.menu-item {
  margin: 0;
}

/* 選單項目按鈕 */
.menu-item-button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--primary-text-color);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.menu-item-button:hover {
  background-color: var(--secondary-card-bg-color);
}

.menu-item-icon {
  width: 20px;
  color: var(--secondary-text-color);
  font-size: 16px;
  text-align: center;
}

/* 登出按鈕特殊樣式 */
.logout-button {
  color: #f44336;
}

.logout-button .menu-item-icon {
  color: #f44336;
}

.logout-button:hover {
  background-color: rgba(244, 67, 54, 0.1);
}

/* 同步指示器 */
.sync-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: auto;
}

.sync-online {
  background-color: #4caf50;
}

.sync-offline {
  background-color: #f44336;
}

.sync-syncing {
  background-color: #ffc107;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* 響應式設計 */
@media only screen and (max-width: 680px) {
  .login-text {
    display: none;
  }

  .login-button {
    padding: 8px 12px;
  }

  .user-name {
    display: none;
  }

  .menu-trigger-button {
    padding: 4px;
    border-radius: 50%;
  }

  .menu-arrow {
    display: none;
  }

  .dropdown-menu {
    min-width: 260px;
    right: -8px;
  }
}
</style>
