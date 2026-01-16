<template>
  <!-- 註冊表單元件 -->
  <div class="ft-register-form">
    <div class="form-header">
      <button
        type="button"
        class="back-btn"
        :disabled="loading"
        @click="handleBack"
      >
        <FontAwesomeIcon :icon="['fas', 'arrow-left']" />
        {{ t('Auth.Back to Sign In') }}
      </button>
      <h2 class="form-title">
        {{ t('Auth.Create Account') }}
      </h2>
      <p class="form-subtitle">
        {{ t('Auth.Join FreeTube today') }}
      </p>
    </div>

    <!-- 錯誤訊息顯示 -->
    <div
      v-if="error"
      class="error-message"
      role="alert"
    >
      <FontAwesomeIcon
        :icon="['fas', 'exclamation-circle']"
        class="error-icon"
      />
      <span>{{ error }}</span>
    </div>

    <form
      class="register-form"
      @submit.prevent="handleSubmit"
    >
      <!-- 用戶名輸入框（必填，含即時驗證） -->
      <div class="form-group">
        <label
          :for="usernameId"
          class="form-label"
        >
          {{ t('Auth.Username') }} <span class="required">*</span>
        </label>
        <div class="input-with-status">
          <input
            :id="usernameId"
            ref="usernameInputRef"
            v-model="formData.username"
            type="text"
            class="form-input"
            :class="{
              'has-error': validationErrors.username,
              'is-valid': formData.username && !validationErrors.username && usernameChecked
            }"
            :placeholder="t('Auth.Choose a username')"
            :disabled="loading"
            autocomplete="username"
            @input="handleUsernameInput"
            @blur="validateUsername"
          >
          <!-- 驗證狀態圖示 -->
          <span
            v-if="formData.username && usernameChecked"
            class="validation-status"
          >
            <FontAwesomeIcon
              v-if="!validationErrors.username"
              :icon="['fas', 'check-circle']"
              class="status-icon valid"
            />
            <FontAwesomeIcon
              v-else
              :icon="['fas', 'times-circle']"
              class="status-icon invalid"
            />
          </span>
        </div>
        <span
          v-if="validationErrors.username"
          class="field-error"
        >
          {{ validationErrors.username }}
        </span>
        <span
          v-else-if="formData.username"
          class="field-hint"
        >
          {{ t('Auth.Username must be 3-20 characters') }}
        </span>
      </div>

      <!-- 顯示名稱輸入框（可選） -->
      <div class="form-group">
        <label
          :for="displayNameId"
          class="form-label"
        >
          {{ t('Auth.Display Name') }}
          <span class="optional">{{ t('Auth.Optional') }}</span>
        </label>
        <input
          :id="displayNameId"
          v-model="formData.displayName"
          type="text"
          class="form-input"
          :placeholder="t('Auth.How others will see you')"
          :disabled="loading"
          autocomplete="name"
        >
      </div>

      <!-- 密碼輸入框 -->
      <div class="form-group">
        <label class="form-label">
          {{ t('Auth.Password') }} <span class="required">*</span>
        </label>
        <FtPasswordInput
          v-model="formData.password"
          :placeholder="t('Auth.Create a password')"
          :has-error="!!validationErrors.password"
          :disabled="loading"
          @input="handlePasswordInput"
          @blur="validatePassword"
        />
        <span
          v-if="validationErrors.password"
          class="field-error"
        >
          {{ validationErrors.password }}
        </span>

        <!-- 密碼強度指示器 -->
        <div
          v-if="formData.password"
          class="password-strength"
        >
          <div class="strength-bar">
            <div
              class="strength-fill"
              :class="passwordStrengthClass"
              :style="{ width: passwordStrengthPercent + '%' }"
            />
          </div>
          <span
            class="strength-text"
            :class="passwordStrengthClass"
          >
            {{ passwordStrengthText }}
          </span>
        </div>
      </div>

      <!-- 確認密碼輸入框 -->
      <div class="form-group">
        <label class="form-label">
          {{ t('Auth.Confirm Password') }} <span class="required">*</span>
        </label>
        <FtPasswordInput
          v-model="formData.confirmPassword"
          :placeholder="t('Auth.Confirm your password')"
          :has-error="!!validationErrors.confirmPassword"
          :disabled="loading"
          @blur="validateConfirmPassword"
        />
        <span
          v-if="validationErrors.confirmPassword"
          class="field-error"
        >
          {{ validationErrors.confirmPassword }}
        </span>
      </div>

      <!-- 註冊按鈕 -->
      <button
        type="submit"
        class="submit-btn primary"
        :disabled="loading || !isFormValid"
      >
        <span
          v-if="loading"
          class="loading-spinner"
        />
        <span v-else>{{ t('Auth.Create Account') }}</span>
      </button>
    </form>

    <!-- 登入連結 -->
    <div class="form-footer">
      <span class="footer-text">{{ t('Auth.Already have an account?') }}</span>
      <button
        type="button"
        class="link-btn"
        :disabled="loading"
        @click="handleBack"
      >
        {{ t('Auth.Sign In') }}
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * 註冊表單元件
 * 提供用戶註冊功能，包含即時驗證與密碼強度指示
 */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { computed, reactive, ref, useId, useTemplateRef } from 'vue'
import { useI18n } from '../../composables/use-i18n-polyfill'
import FtPasswordInput from './ft-password-input.vue'

const { t } = useI18n()

// Props 定義
const props = defineProps({
  // 是否載入中
  loading: {
    type: Boolean,
    default: false
  },
  // 錯誤訊息
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['register', 'back'])

// 產生唯一 ID
const usernameId = useId()
const displayNameId = useId()

// 用戶名輸入框參照
const usernameInputRef = useTemplateRef('usernameInputRef')

// 表單資料
const formData = reactive({
  username: '',
  displayName: '',
  password: '',
  confirmPassword: ''
})

// 驗證錯誤
const validationErrors = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

// 用戶名是否已檢查
const usernameChecked = ref(false)

// 用戶名輸入防抖計時器
let usernameDebounceTimer = null

/**
 * 處理用戶名輸入（防抖驗證）
 */
function handleUsernameInput() {
  usernameChecked.value = false
  validationErrors.username = ''

  // 清除之前的計時器
  if (usernameDebounceTimer) {
    clearTimeout(usernameDebounceTimer)
  }

  // 設定新的防抖計時器
  usernameDebounceTimer = setTimeout(() => {
    if (formData.username.trim()) {
      validateUsername()
    }
  }, 500)
}

/**
 * 驗證用戶名
 */
function validateUsername() {
  const username = formData.username.trim()

  if (!username) {
    validationErrors.username = t('Auth.Username is required')
    usernameChecked.value = true
    return false
  }

  if (username.length < 3) {
    validationErrors.username = t('Auth.Username must be at least 3 characters')
    usernameChecked.value = true
    return false
  }

  if (username.length > 20) {
    validationErrors.username = t('Auth.Username must be at most 20 characters')
    usernameChecked.value = true
    return false
  }

  // 只允許字母、數字、底線
  const usernameRegex = /^[a-zA-Z0-9_]+$/
  if (!usernameRegex.test(username)) {
    validationErrors.username = t('Auth.Username can only contain letters, numbers, and underscores')
    usernameChecked.value = true
    return false
  }

  validationErrors.username = ''
  usernameChecked.value = true
  return true
}

/**
 * 處理密碼輸入
 */
function handlePasswordInput() {
  // 如果確認密碼已填寫，重新驗證
  if (formData.confirmPassword) {
    validateConfirmPassword()
  }
}

/**
 * 驗證密碼
 */
function validatePassword() {
  if (!formData.password) {
    validationErrors.password = t('Auth.Password is required')
    return false
  }

  if (formData.password.length < 6) {
    validationErrors.password = t('Auth.Password must be at least 6 characters')
    return false
  }

  validationErrors.password = ''
  return true
}

/**
 * 驗證確認密碼
 */
function validateConfirmPassword() {
  if (!formData.confirmPassword) {
    validationErrors.confirmPassword = t('Auth.Please confirm your password')
    return false
  }

  if (formData.password !== formData.confirmPassword) {
    validationErrors.confirmPassword = t('Auth.Passwords do not match')
    return false
  }

  validationErrors.confirmPassword = ''
  return true
}

/**
 * 計算密碼強度（0-4）
 */
const passwordStrength = computed(() => {
  const password = formData.password
  if (!password) return 0

  let strength = 0

  // 長度檢查
  if (password.length >= 6) strength++
  if (password.length >= 10) strength++

  // 複雜度檢查
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++

  return Math.min(strength, 4)
})

/**
 * 密碼強度百分比
 */
const passwordStrengthPercent = computed(() => {
  return (passwordStrength.value / 4) * 100
})

/**
 * 密碼強度 CSS 類別
 */
const passwordStrengthClass = computed(() => {
  const strength = passwordStrength.value
  if (strength <= 1) return 'weak'
  if (strength <= 2) return 'fair'
  if (strength <= 3) return 'good'
  return 'strong'
})

/**
 * 密碼強度文字
 */
const passwordStrengthText = computed(() => {
  const strength = passwordStrength.value
  if (strength <= 1) return t('Auth.Weak')
  if (strength <= 2) return t('Auth.Fair')
  if (strength <= 3) return t('Auth.Good')
  return t('Auth.Strong')
})

/**
 * 檢查表單是否有效
 */
const isFormValid = computed(() => {
  return (
    formData.username.trim().length >= 3 &&
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword &&
    !validationErrors.username &&
    !validationErrors.password &&
    !validationErrors.confirmPassword
  )
})

/**
 * 處理表單提交
 */
function handleSubmit() {
  const isUsernameValid = validateUsername()
  const isPasswordValid = validatePassword()
  const isConfirmValid = validateConfirmPassword()

  if (isUsernameValid && isPasswordValid && isConfirmValid) {
    emit('register', {
      username: formData.username.trim(),
      displayName: formData.displayName.trim() || formData.username.trim(),
      password: formData.password
    })
  }
}

/**
 * 處理返回
 */
function handleBack() {
  emit('back')
}

// 暴露方法供父元件使用
defineExpose({
  focus: () => usernameInputRef.value?.focus(),
  reset: () => {
    formData.username = ''
    formData.displayName = ''
    formData.password = ''
    formData.confirmPassword = ''
    validationErrors.username = ''
    validationErrors.password = ''
    validationErrors.confirmPassword = ''
    usernameChecked.value = false
  }
})
</script>

<style scoped>
.ft-register-form {
  width: 100%;
  max-width: 440px;
  padding: 32px;
  background: var(--card-bg-color);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.form-header {
  margin-block-end: 24px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  margin-block-end: 16px;
  border: none;
  background: none;
  color: var(--primary-color);
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.back-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.back-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-text-color);
  margin: 0 0 8px;
}

.form-subtitle {
  font-size: 14px;
  color: var(--secondary-text-color);
  margin: 0;
}

/* 錯誤訊息區塊 */
.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-block-end: 20px;
  background-color: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.3);
  border-radius: 8px;
  color: #ff5252;
  font-size: 14px;
}

.error-icon {
  flex-shrink: 0;
}

/* 表單群組 */
.form-group {
  margin-block-end: 20px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-block-end: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color);
}

.required {
  color: #ff5252;
}

.optional {
  font-weight: 400;
  color: var(--tertiary-text-color);
  font-size: 12px;
}

.input-with-status {
  position: relative;
}

.form-input {
  box-sizing: border-box;
  inline-size: 100%;
  padding: 12px 16px;
  padding-inline-end: 44px;
  border: 2px solid var(--scrollbar-color);
  border-radius: 8px;
  background-color: var(--bg-color);
  color: var(--primary-text-color);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-input::placeholder {
  color: var(--tertiary-text-color);
}

.form-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--accent-color-opacity2);
}

.form-input.has-error {
  border-color: #ff5252;
}

.form-input.is-valid {
  border-color: #4caf50;
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--secondary-card-bg-color);
}

.validation-status {
  position: absolute;
  inset-inline-end: 12px;
  inset-block-start: 50%;
  transform: translateY(-50%);
}

.status-icon {
  width: 20px;
  height: 20px;
}

.status-icon.valid {
  color: #4caf50;
}

.status-icon.invalid {
  color: #ff5252;
}

.field-error {
  display: block;
  margin-block-start: 6px;
  font-size: 12px;
  color: #ff5252;
}

.field-hint {
  display: block;
  margin-block-start: 6px;
  font-size: 12px;
  color: var(--tertiary-text-color);
}

/* 密碼強度指示器 */
.password-strength {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-block-start: 10px;
}

.strength-bar {
  flex: 1;
  height: 6px;
  background-color: var(--scrollbar-color);
  border-radius: 3px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-fill.weak {
  background-color: #ff5252;
}

.strength-fill.fair {
  background-color: #ff9800;
}

.strength-fill.good {
  background-color: #8bc34a;
}

.strength-fill.strong {
  background-color: #4caf50;
}

.strength-text {
  font-size: 12px;
  font-weight: 500;
  min-width: 50px;
}

.strength-text.weak {
  color: #ff5252;
}

.strength-text.fair {
  color: #ff9800;
}

.strength-text.good {
  color: #8bc34a;
}

.strength-text.strong {
  color: #4caf50;
}

/* 按鈕 */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  margin-block-start: 8px;
  border: 2px solid transparent;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-btn.primary {
  background-color: var(--primary-color);
  color: var(--text-with-main-color);
  border-color: var(--primary-color);
}

.submit-btn.primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

.submit-btn.primary:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 載入動畫 */
.loading-spinner {
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

/* 表單底部 */
.form-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-block-start: 24px;
  padding-block-start: 20px;
  border-block-start: 1px solid var(--scrollbar-color);
}

.footer-text {
  font-size: 14px;
  color: var(--secondary-text-color);
}

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--primary-color);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}

.link-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 響應式設計 */
@media (max-width: 480px) {
  .ft-register-form {
    padding: 24px 20px;
    border-radius: 12px;
  }

  .form-title {
    font-size: 24px;
  }
}
</style>
