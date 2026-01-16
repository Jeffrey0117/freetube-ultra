<template>
  <!-- 登入表單元件 -->
  <div class="ft-login-form">
    <div class="form-header">
      <h2 class="form-title">
        {{ t('Auth.Sign In') }}
      </h2>
      <p class="form-subtitle">
        {{ t('Auth.Sign in to your account') }}
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
      class="login-form"
      @submit.prevent="handleSubmit"
    >
      <!-- 用戶名輸入框 -->
      <div class="form-group">
        <label
          :for="usernameId"
          class="form-label"
        >
          {{ t('Auth.Username') }}
        </label>
        <input
          :id="usernameId"
          ref="usernameInputRef"
          v-model="formData.username"
          type="text"
          class="form-input"
          :class="{ 'has-error': validationErrors.username }"
          :placeholder="t('Auth.Enter your username')"
          :disabled="loading"
          autocomplete="username"
          @blur="validateUsername"
        >
        <span
          v-if="validationErrors.username"
          class="field-error"
        >
          {{ validationErrors.username }}
        </span>
      </div>

      <!-- 密碼輸入框 -->
      <div class="form-group">
        <label class="form-label">
          {{ t('Auth.Password') }}
        </label>
        <FtPasswordInput
          v-model="formData.password"
          :placeholder="t('Auth.Enter your password')"
          :has-error="!!validationErrors.password"
          :disabled="loading"
          @blur="validatePassword"
        />
        <span
          v-if="validationErrors.password"
          class="field-error"
        >
          {{ validationErrors.password }}
        </span>
      </div>

      <!-- 記住我 checkbox -->
      <div class="form-group remember-me">
        <label class="checkbox-label">
          <input
            v-model="formData.rememberMe"
            type="checkbox"
            class="checkbox-input"
            :disabled="loading"
          >
          <span class="checkbox-custom" />
          <span class="checkbox-text">{{ t('Auth.Remember me') }}</span>
        </label>
      </div>

      <!-- 登入按鈕 -->
      <button
        type="submit"
        class="submit-btn primary"
        :disabled="loading || !isFormValid"
      >
        <span
          v-if="loading"
          class="loading-spinner"
        />
        <span v-else>{{ t('Auth.Sign In') }}</span>
      </button>

      <!-- 訪客模式按鈕 -->
      <button
        type="button"
        class="submit-btn secondary"
        :disabled="loading"
        @click="handleGuestMode"
      >
        <FontAwesomeIcon
          :icon="['fas', 'user-secret']"
          class="btn-icon"
        />
        <span>{{ t('Auth.Continue as Guest') }}</span>
      </button>
    </form>

    <!-- 註冊連結 -->
    <div class="form-footer">
      <span class="footer-text">{{ t('Auth.No account?') }}</span>
      <button
        type="button"
        class="link-btn"
        :disabled="loading"
        @click="handleRegisterClick"
      >
        {{ t('Auth.Create Account') }}
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * 登入表單元件
 * 提供用戶登入功能，包含驗證、錯誤處理及訪客模式
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

const emit = defineEmits(['login', 'register', 'guest'])

// 產生唯一 ID
const usernameId = useId()

// 用戶名輸入框參照
const usernameInputRef = useTemplateRef('usernameInputRef')

// 表單資料
const formData = reactive({
  username: '',
  password: '',
  rememberMe: false
})

// 驗證錯誤
const validationErrors = reactive({
  username: '',
  password: ''
})

/**
 * 驗證用戶名
 */
function validateUsername() {
  if (!formData.username.trim()) {
    validationErrors.username = t('Auth.Username is required')
    return false
  }
  if (formData.username.length < 3) {
    validationErrors.username = t('Auth.Username must be at least 3 characters')
    return false
  }
  validationErrors.username = ''
  return true
}

/**
 * 驗證密碼
 */
function validatePassword() {
  if (!formData.password) {
    validationErrors.password = t('Auth.Password is required')
    return false
  }
  validationErrors.password = ''
  return true
}

/**
 * 檢查表單是否有效
 */
const isFormValid = computed(() => {
  return formData.username.trim().length >= 3 && formData.password.length > 0
})

/**
 * 處理表單提交
 */
function handleSubmit() {
  const isUsernameValid = validateUsername()
  const isPasswordValid = validatePassword()

  if (isUsernameValid && isPasswordValid) {
    emit('login', {
      username: formData.username.trim(),
      password: formData.password,
      rememberMe: formData.rememberMe
    })
  }
}

/**
 * 處理訪客模式
 */
function handleGuestMode() {
  emit('guest')
}

/**
 * 處理註冊點擊
 */
function handleRegisterClick() {
  emit('register')
}

// 暴露方法供父元件使用
defineExpose({
  focus: () => usernameInputRef.value?.focus(),
  reset: () => {
    formData.username = ''
    formData.password = ''
    formData.rememberMe = false
    validationErrors.username = ''
    validationErrors.password = ''
  }
})
</script>

<style scoped>
.ft-login-form {
  width: 100%;
  max-width: 400px;
  padding: 32px;
  background: var(--card-bg-color);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.form-header {
  text-align: center;
  margin-block-end: 24px;
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
  display: block;
  margin-block-end: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color);
}

.form-input {
  box-sizing: border-box;
  inline-size: 100%;
  padding: 12px 16px;
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

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--secondary-card-bg-color);
}

.field-error {
  display: block;
  margin-block-start: 6px;
  font-size: 12px;
  color: #ff5252;
}

/* 記住我 checkbox */
.remember-me {
  margin-block-end: 24px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkbox-custom {
  position: relative;
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--scrollbar-color);
  border-radius: 4px;
  background-color: var(--bg-color);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.checkbox-input:checked + .checkbox-custom {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 6px;
  width: 5px;
  height: 10px;
  border: solid var(--text-with-main-color);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-input:focus + .checkbox-custom {
  box-shadow: 0 0 0 3px var(--accent-color-opacity2);
}

.checkbox-input:disabled + .checkbox-custom {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-text {
  font-size: 14px;
  color: var(--primary-text-color);
}

/* 按鈕 */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  margin-block-end: 12px;
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

.submit-btn.secondary {
  background-color: var(--secondary-card-bg-color);
  color: var(--primary-text-color);
  border-color: var(--scrollbar-color);
}

.submit-btn.secondary:hover:not(:disabled) {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  width: 18px;
  height: 18px;
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
  margin-block-start: 20px;
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
  .ft-login-form {
    padding: 24px 20px;
    border-radius: 12px;
  }

  .form-title {
    font-size: 24px;
  }
}
</style>
