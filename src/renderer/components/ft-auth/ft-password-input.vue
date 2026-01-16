<template>
  <!-- 密碼輸入元件：支援顯示/隱藏切換 -->
  <div class="ft-password-input">
    <label
      v-if="label"
      :for="inputId"
      class="password-label"
    >
      {{ label }}
    </label>
    <div class="input-wrapper">
      <input
        :id="inputId"
        ref="inputRef"
        :type="showPassword ? 'text' : 'password'"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="password-input"
        :class="{ 'has-error': hasError, disabled }"
        autocomplete="off"
        @input="handleInput"
        @blur="$emit('blur')"
        @focus="$emit('focus')"
      >
      <!-- 顯示/隱藏密碼按鈕 -->
      <button
        type="button"
        class="toggle-visibility-btn"
        :aria-label="showPassword ? t('Auth.Hide Password') : t('Auth.Show Password')"
        :title="showPassword ? t('Auth.Hide Password') : t('Auth.Show Password')"
        @click="toggleVisibility"
      >
        <FontAwesomeIcon
          :icon="['fas', showPassword ? 'eye-slash' : 'eye']"
          class="toggle-icon"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * 密碼輸入元件
 * 提供密碼輸入功能，支援顯示/隱藏密碼切換
 */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { ref, useId, useTemplateRef } from 'vue'
import { useI18n } from '../../composables/use-i18n-polyfill'

const { t } = useI18n()

// Props 定義
const props = defineProps({
  // 綁定值（v-model）
  modelValue: {
    type: String,
    default: ''
  },
  // 輸入框佔位文字
  placeholder: {
    type: String,
    default: ''
  },
  // 標籤文字
  label: {
    type: String,
    default: ''
  },
  // 是否有錯誤狀態
  hasError: {
    type: Boolean,
    default: false
  },
  // 是否禁用
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'blur', 'focus'])

// 產生唯一 ID
const inputId = useId()

// 輸入框參照
const inputRef = useTemplateRef('inputRef')

// 是否顯示密碼
const showPassword = ref(false)

/**
 * 切換密碼顯示狀態
 */
function toggleVisibility() {
  showPassword.value = !showPassword.value
}

/**
 * 處理輸入事件
 * @param {Event} event - 輸入事件
 */
function handleInput(event) {
  emit('update:modelValue', event.target.value)
}

// 暴露方法供父元件使用
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur()
})
</script>

<style scoped>
.ft-password-input {
  position: relative;
  width: 100%;
}

.password-label {
  display: block;
  margin-block-end: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  box-sizing: border-box;
  inline-size: 100%;
  padding: 12px 16px;
  padding-inline-end: 48px;
  border: 2px solid var(--scrollbar-color);
  border-radius: 8px;
  background-color: var(--bg-color);
  color: var(--primary-text-color);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.password-input::placeholder {
  color: var(--tertiary-text-color);
}

.password-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--accent-color-opacity2);
}

.password-input.has-error {
  border-color: var(--accent-color);
}

.password-input.has-error:focus {
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.password-input.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--secondary-card-bg-color);
}

.toggle-visibility-btn {
  position: absolute;
  inset-inline-end: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--secondary-text-color);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.toggle-visibility-btn:hover {
  background-color: var(--side-nav-hover-color);
  color: var(--primary-text-color);
}

.toggle-visibility-btn:active {
  background-color: var(--tertiary-text-color);
}

.toggle-icon {
  width: 18px;
  height: 18px;
}
</style>
