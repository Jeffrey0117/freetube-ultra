<template>
  <div class="switch-user-page">
    <div class="switch-user-card">
      <!-- 標題 -->
      <div class="page-header">
        <button
          class="back-btn"
          @click="goBack"
        >
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <h1 class="page-title">{{ $t('User.Switch Account') }}</h1>
      </div>

      <!-- 當前用戶（如果已登入） -->
      <div
        v-if="currentUser"
        class="current-user-section"
      >
        <p class="section-label">{{ $t('User.Current Account') }}</p>
        <div class="current-user-card">
          <ft-user-avatar
            :src="currentUser.avatar"
            :alt="currentUser.displayName || currentUser.username"
            size="medium"
          />
          <div class="user-info">
            <span class="user-name">{{ currentUser.displayName || currentUser.username }}</span>
            <span class="user-username">@{{ currentUser.username }}</span>
          </div>
          <button
            class="logout-btn"
            @click="handleLogout"
          >
            <font-awesome-icon :icon="['fas', 'sign-out-alt']" />
            {{ $t('User.Logout') }}
          </button>
        </div>
      </div>

      <!-- 其他帳戶列表 -->
      <div class="accounts-section">
        <p class="section-label">{{ $t('User.Other Accounts') }}</p>

        <div
          v-if="otherUsers.length === 0"
          class="empty-state"
        >
          <font-awesome-icon
            :icon="['fas', 'users']"
            class="empty-icon"
          />
          <p>{{ $t('User.No other accounts') }}</p>
        </div>

        <div
          v-else
          class="accounts-list"
        >
          <button
            v-for="user in otherUsers"
            :key="user._id"
            class="account-card"
            :class="{ selected: selectedUserId === user._id }"
            @click="selectUser(user)"
          >
            <ft-user-avatar
              :src="user.avatar"
              :alt="user.displayName || user.username"
              size="medium"
            />
            <div class="user-info">
              <span class="user-name">{{ user.displayName || user.username }}</span>
              <span class="user-username">@{{ user.username }}</span>
              <span
                v-if="user.lastLoginAt"
                class="last-login"
              >
                {{ $t('User.Last login') }}: {{ formatDate(user.lastLoginAt) }}
              </span>
            </div>
            <font-awesome-icon
              v-if="selectedUserId === user._id"
              :icon="['fas', 'check-circle']"
              class="check-icon"
            />
          </button>
        </div>
      </div>

      <!-- 密碼輸入（切換帳戶時需要） -->
      <div
        v-if="selectedUserId && selectedUser"
        class="password-section"
      >
        <p class="section-label">{{ $t('User.Enter password for') }} {{ selectedUser.displayName || selectedUser.username }}</p>
        <div class="input-wrapper">
          <font-awesome-icon
            :icon="['fas', 'lock']"
            class="input-icon"
          />
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            class="form-input"
            :placeholder="$t('User.Enter password')"
            @keydown.enter="handleSwitch"
          >
          <button
            type="button"
            class="toggle-password"
            @click="showPassword = !showPassword"
          >
            <font-awesome-icon :icon="['fas', showPassword ? 'eye-slash' : 'eye']" />
          </button>
        </div>

        <!-- 錯誤訊息 -->
        <div
          v-if="errorMessage"
          class="error-message"
        >
          <font-awesome-icon :icon="['fas', 'exclamation-circle']" />
          {{ errorMessage }}
        </div>

        <button
          class="switch-btn"
          :disabled="isLoading || !password"
          @click="handleSwitch"
        >
          <span v-if="isLoading" class="spinner" />
          <span v-else>{{ $t('User.Switch Account') }}</span>
        </button>
      </div>

      <!-- 分隔線 -->
      <div class="divider" />

      <!-- 新增帳戶 -->
      <button
        class="add-account-btn"
        @click="navigateToRegister"
      >
        <font-awesome-icon :icon="['fas', 'plus-circle']" />
        {{ $t('User.Add Another Account') }}
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * SwitchUser.vue - 切換帳戶頁面
 *
 * 功能：
 * - 顯示當前登入帳戶
 * - 列出所有本地帳戶
 * - 切換到其他帳戶（需要密碼）
 * - 新增帳戶
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import FtUserAvatar from '../../components/ft-user-avatar/ft-user-avatar.vue'

const router = useRouter()
const store = useStore()

// 狀態
const selectedUserId = ref(null)
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')

// 計算屬性：載入狀態
const isLoading = computed(() => store.getters['user/isLoading'] || false)

// 計算屬性：當前用戶
const currentUser = computed(() => {
  if (!store.getters['user/isLoggedIn']) return null
  return store.getters['user/currentUser']
})

// 計算屬性：所有本地用戶
const localUsers = computed(() => store.getters['user/localUsers'] || [])

// 計算屬性：其他用戶（排除當前用戶）
const otherUsers = computed(() => {
  const currentId = currentUser.value?._id
  return localUsers.value.filter(user => user._id !== currentId)
})

// 計算屬性：選中的用戶
const selectedUser = computed(() => {
  if (!selectedUserId.value) return null
  return localUsers.value.find(user => user._id === selectedUserId.value)
})

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

// 返回上一頁
function goBack() {
  router.back()
}

// 選擇用戶
function selectUser(user) {
  if (selectedUserId.value === user._id) {
    // 取消選擇
    selectedUserId.value = null
    password.value = ''
    errorMessage.value = ''
  } else {
    // 選擇新用戶
    selectedUserId.value = user._id
    password.value = ''
    errorMessage.value = ''
  }
}

// 處理切換
async function handleSwitch() {
  if (!selectedUserId.value || !password.value) return

  errorMessage.value = ''

  try {
    // 先登出當前用戶
    if (currentUser.value) {
      await store.dispatch('user/logout')
    }

    // 登入選中的用戶
    const result = await store.dispatch('user/login', {
      username: selectedUser.value.username,
      password: password.value
    })

    if (result.success) {
      // 登入成功，導向個人檔案
      router.push('/profile')
    } else {
      errorMessage.value = result.error || '切換帳戶失敗'
    }
  } catch (error) {
    errorMessage.value = error.message || '切換帳戶時發生錯誤'
  }
}

// 處理登出
async function handleLogout() {
  try {
    await store.dispatch('user/logout')
    // 重新載入頁面以更新狀態
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

// 導航到註冊頁面
function navigateToRegister() {
  router.push('/register')
}

// 初始化
onMounted(async () => {
  // 載入本地用戶列表
  await store.dispatch('user/loadLocalUsers')
})
</script>

<style scoped>
/* 頁面容器 */
.switch-user-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: var(--bg-color);
}

/* 卡片 */
.switch-user-card {
  width: 100%;
  max-width: 480px;
  padding: 24px;
  background-color: var(--card-bg-color);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* 頁面標題 */
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.back-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background-color: var(--secondary-card-bg-color);
  color: var(--primary-text-color);
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.back-btn:hover {
  background-color: var(--scrollbar-color);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-text-color);
  margin: 0;
}

/* 區段標籤 */
.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--secondary-text-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

/* 當前用戶區塊 */
.current-user-section {
  margin-bottom: 24px;
}

.current-user-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: var(--secondary-card-bg-color);
  border-radius: 12px;
  border: 2px solid var(--primary-color);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-username {
  font-size: 13px;
  color: var(--secondary-text-color);
}

.last-login {
  font-size: 11px;
  color: var(--secondary-text-color);
  margin-top: 4px;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background-color: rgba(244, 67, 54, 0.1);
  color: #f44336;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.logout-btn:hover {
  background-color: rgba(244, 67, 54, 0.2);
}

/* 帳戶列表區塊 */
.accounts-section {
  margin-bottom: 24px;
}

.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 2px solid var(--scrollbar-color);
  border-radius: 12px;
  background: transparent;
  color: var(--primary-text-color);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.account-card:hover {
  border-color: var(--primary-color);
  background-color: var(--accent-color-opacity2);
}

.account-card.selected {
  border-color: var(--primary-color);
  background-color: var(--accent-color-opacity2);
}

.check-icon {
  color: var(--primary-color);
  font-size: 20px;
}

/* 空狀態 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  color: var(--scrollbar-color);
  margin-bottom: 12px;
}

.empty-state p {
  font-size: 14px;
  color: var(--secondary-text-color);
  margin: 0;
}

/* 密碼區塊 */
.password-section {
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--secondary-card-bg-color);
  border-radius: 12px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: var(--secondary-text-color);
  font-size: 16px;
  pointer-events: none;
}

.form-input {
  width: 100%;
  padding: 14px 44px 14px 44px;
  border: 2px solid var(--scrollbar-color);
  border-radius: 10px;
  background-color: var(--bg-color);
  color: var(--primary-text-color);
  font-size: 15px;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.toggle-password {
  position: absolute;
  right: 12px;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--secondary-text-color);
  cursor: pointer;
  font-size: 16px;
}

.toggle-password:hover {
  color: var(--primary-text-color);
}

/* 錯誤訊息 */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  color: #f44336;
  font-size: 14px;
  margin-bottom: 12px;
}

/* 切換按鈕 */
.switch-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background-color: var(--primary-color);
  color: var(--text-with-main-color);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s ease;
}

.switch-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.switch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 分隔線 */
.divider {
  height: 1px;
  background-color: var(--scrollbar-color);
  margin: 0 0 16px 0;
}

/* 新增帳戶按鈕 */
.add-account-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px;
  border: 2px dashed var(--scrollbar-color);
  border-radius: 12px;
  background: transparent;
  color: var(--secondary-text-color);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-account-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background-color: var(--accent-color-opacity2);
}
</style>
