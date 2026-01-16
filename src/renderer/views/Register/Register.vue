<template>
  <div class="register-page">
    <div class="register-card">
      <!-- 標題 -->
      <div class="register-header">
        <h1 class="register-title">{{ $t('User.Create Account') }}</h1>
        <p class="register-subtitle">{{ $t('User.Join FreeTube today') }}</p>
      </div>

      <!-- 註冊表單 -->
      <form
        class="register-form"
        @submit.prevent="handleRegister"
      >
        <!-- 用戶名 -->
        <div class="form-group">
          <label for="username">{{ $t('User.Username') }}</label>
          <div class="input-wrapper">
            <font-awesome-icon
              :icon="['fas', 'user']"
              class="input-icon"
            />
            <input
              id="username"
              v-model="username"
              type="text"
              class="form-input"
              :class="{ 'has-error': usernameError }"
              :placeholder="$t('User.Choose a username')"
              autocomplete="username"
              required
              @input="validateUsername"
            >
          </div>
          <span
            v-if="usernameError"
            class="field-error"
          >{{ usernameError }}</span>
          <span
            v-else
            class="field-hint"
          >{{ $t('User.Username requirements') }}</span>
        </div>

        <!-- 顯示名稱 -->
        <div class="form-group">
          <label for="displayName">{{ $t('User.Display Name') }} <span class="optional">({{ $t('User.Optional') }})</span></label>
          <div class="input-wrapper">
            <font-awesome-icon
              :icon="['fas', 'id-card']"
              class="input-icon"
            />
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              class="form-input"
              :placeholder="$t('User.Enter display name')"
            >
          </div>
        </div>

        <!-- 密碼 -->
        <div class="form-group">
          <label for="password">{{ $t('User.Password') }}</label>
          <div class="input-wrapper">
            <font-awesome-icon
              :icon="['fas', 'lock']"
              class="input-icon"
            />
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ 'has-error': passwordError }"
              :placeholder="$t('User.Create a password')"
              autocomplete="new-password"
              required
              @input="validatePassword"
            >
            <button
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
            >
              <font-awesome-icon :icon="['fas', showPassword ? 'eye-slash' : 'eye']" />
            </button>
          </div>
          <span
            v-if="passwordError"
            class="field-error"
          >{{ passwordError }}</span>

          <!-- 密碼強度指示器 -->
          <div
            v-if="password"
            class="password-strength"
          >
            <div
              class="strength-bar"
              :class="passwordStrengthClass"
            >
              <div
                class="strength-fill"
                :style="{ width: passwordStrengthPercent + '%' }"
              />
            </div>
            <span class="strength-text">{{ passwordStrengthText }}</span>
          </div>
        </div>

        <!-- 確認密碼 -->
        <div class="form-group">
          <label for="confirmPassword">{{ $t('User.Confirm Password') }}</label>
          <div class="input-wrapper">
            <font-awesome-icon
              :icon="['fas', 'lock']"
              class="input-icon"
            />
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ 'has-error': confirmPasswordError }"
              :placeholder="$t('User.Confirm your password')"
              autocomplete="new-password"
              required
              @input="validateConfirmPassword"
            >
          </div>
          <span
            v-if="confirmPasswordError"
            class="field-error"
          >{{ confirmPasswordError }}</span>
        </div>

        <!-- 錯誤訊息 -->
        <div
          v-if="errorMessage"
          class="error-message"
        >
          <font-awesome-icon :icon="['fas', 'exclamation-circle']" />
          {{ errorMessage }}
        </div>

        <!-- 註冊按鈕 -->
        <button
          type="submit"
          class="register-btn"
          :disabled="isLoading || !isFormValid"
        >
          <span v-if="isLoading" class="spinner" />
          <span v-else>{{ $t('User.Create Account') }}</span>
        </button>
      </form>

      <!-- 登入連結 -->
      <p class="login-link">
        {{ $t('User.Already have account') }}
        <router-link to="/login">{{ $t('User.Login') }}</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
/**
 * Register.vue - 註冊頁面
 *
 * 功能：
 * - 用戶名、密碼、確認密碼表單
 * - 即時表單驗證
 * - 密碼強度指示器
 * - 顯示密碼切換
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'

const router = useRouter()
const store = useStore()

// 表單狀態
const username = ref('')
const displayName = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)

// 驗證錯誤
const usernameError = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')
const errorMessage = ref('')

// 載入狀態
const isLoading = computed(() => store.getters['user/isLoading'] || false)

// 驗證用戶名
function validateUsername() {
  const value = username.value.trim()
  if (!value) {
    usernameError.value = ''
    return false
  }

  if (value.length < 3) {
    usernameError.value = '用戶名至少需要 3 個字元'
    return false
  }

  if (value.length > 20) {
    usernameError.value = '用戶名最多 20 個字元'
    return false
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    usernameError.value = '用戶名只能包含英文字母、數字、底線和連字號'
    return false
  }

  usernameError.value = ''
  return true
}

// 驗證密碼
function validatePassword() {
  const value = password.value
  if (!value) {
    passwordError.value = ''
    return false
  }

  if (value.length < 4) {
    passwordError.value = '密碼至少需要 4 個字元'
    return false
  }

  passwordError.value = ''

  // 同時驗證確認密碼
  if (confirmPassword.value) {
    validateConfirmPassword()
  }

  return true
}

// 驗證確認密碼
function validateConfirmPassword() {
  const value = confirmPassword.value
  if (!value) {
    confirmPasswordError.value = ''
    return false
  }

  if (value !== password.value) {
    confirmPasswordError.value = '密碼不一致'
    return false
  }

  confirmPasswordError.value = ''
  return true
}

// 密碼強度計算
const passwordStrength = computed(() => {
  const pwd = password.value
  if (!pwd) return 0

  let strength = 0

  // 長度分數
  if (pwd.length >= 4) strength += 1
  if (pwd.length >= 8) strength += 1
  if (pwd.length >= 12) strength += 1

  // 複雜度分數
  if (/[a-z]/.test(pwd)) strength += 1
  if (/[A-Z]/.test(pwd)) strength += 1
  if (/[0-9]/.test(pwd)) strength += 1
  if (/[^a-zA-Z0-9]/.test(pwd)) strength += 1

  return Math.min(strength, 7)
})

const passwordStrengthPercent = computed(() => {
  return (passwordStrength.value / 7) * 100
})

const passwordStrengthClass = computed(() => {
  if (passwordStrength.value <= 2) return 'strength-weak'
  if (passwordStrength.value <= 4) return 'strength-medium'
  return 'strength-strong'
})

const passwordStrengthText = computed(() => {
  if (passwordStrength.value <= 2) return '弱'
  if (passwordStrength.value <= 4) return '中等'
  return '強'
})

// 表單是否有效
const isFormValid = computed(() => {
  return (
    username.value.trim().length >= 3 &&
    password.value.length >= 4 &&
    password.value === confirmPassword.value &&
    !usernameError.value &&
    !passwordError.value &&
    !confirmPasswordError.value
  )
})

// 處理註冊
async function handleRegister() {
  errorMessage.value = ''

  // 驗證表單
  const isUsernameValid = validateUsername()
  const isPasswordValid = validatePassword()
  const isConfirmValid = validateConfirmPassword()

  if (!isUsernameValid || !isPasswordValid || !isConfirmValid) {
    return
  }

  try {
    const result = await store.dispatch('user/register', {
      username: username.value.trim(),
      password: password.value,
      displayName: displayName.value.trim() || undefined
    })

    if (result.success) {
      // 註冊成功，導向個人檔案
      router.push('/profile')
    } else {
      errorMessage.value = result.error || '註冊失敗'
    }
  } catch (error) {
    errorMessage.value = error.message || '註冊時發生錯誤'
  }
}

// 初始化
onMounted(() => {
  // 如果已經登入，導向個人檔案
  if (store.getters['user/isLoggedIn']) {
    router.push('/profile')
  }
})
</script>

<style scoped>
/* 頁面容器 */
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: var(--bg-color);
}

/* 註冊卡片 */
.register-card {
  width: 100%;
  max-width: 420px;
  padding: 32px;
  background-color: var(--card-bg-color);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* 標題區域 */
.register-header {
  text-align: center;
  margin-bottom: 32px;
}

.register-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-text-color);
  margin: 0 0 8px 0;
}

.register-subtitle {
  font-size: 14px;
  color: var(--secondary-text-color);
  margin: 0;
}

/* 表單 */
.register-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color);
}

.optional {
  font-weight: 400;
  color: var(--secondary-text-color);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
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
  padding: 14px 14px 14px 44px;
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

.form-input.has-error {
  border-color: #f44336;
}

.form-input::placeholder {
  color: var(--secondary-text-color);
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

/* 欄位提示和錯誤 */
.field-hint {
  font-size: 12px;
  color: var(--secondary-text-color);
}

.field-error {
  font-size: 12px;
  color: #f44336;
}

/* 密碼強度指示器 */
.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background-color: var(--scrollbar-color);
  border-radius: 2px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-weak .strength-fill {
  background-color: #f44336;
}

.strength-medium .strength-fill {
  background-color: #ffc107;
}

.strength-strong .strength-fill {
  background-color: #4caf50;
}

.strength-text {
  font-size: 12px;
  min-width: 32px;
}

.strength-weak .strength-text {
  color: #f44336;
}

.strength-medium .strength-text {
  color: #ffc107;
}

.strength-strong .strength-text {
  color: #4caf50;
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
}

/* 註冊按鈕 */
.register-btn {
  padding: 14px;
  border: none;
  border-radius: 10px;
  background-color: var(--primary-color);
  color: var(--text-with-main-color);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s ease, transform 0.15s ease;
}

.register-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.register-btn:active:not(:disabled) {
  transform: translateY(0);
}

.register-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
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

/* 登入連結 */
.login-link {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--secondary-text-color);
}

.login-link a {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.login-link a:hover {
  text-decoration: underline;
}
</style>
