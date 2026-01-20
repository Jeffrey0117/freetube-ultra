<template>
  <FtSettingsSection
    :title="$t('Settings.YouTube Account Settings.YouTube Account Settings')"
  >
    <!-- 說明文字 -->
    <p class="description">
      {{ $t('Settings.YouTube Account Settings.Description') }}
    </p>

    <!-- 連接狀態 -->
    <div class="statusContainer">
      <div class="statusRow">
        <span class="statusLabel">{{ $t('Settings.YouTube Account Settings.Status') }}:</span>
        <span
          :class="['statusValue', connectionStatusClass]"
        >
          <font-awesome-icon
            :icon="statusIcon"
            class="statusIcon"
          />
          {{ statusText }}
        </span>
      </div>
      <div
        v-if="isConnected && accountName"
        class="accountNameRow"
      >
        <span class="accountLabel">{{ $t('Settings.YouTube Account Settings.Account') }}:</span>
        <span class="accountName">{{ accountName }}</span>
      </div>
    </div>

    <!-- 錯誤訊息 -->
    <div
      v-if="error"
      class="errorContainer"
    >
      <font-awesome-icon
        :icon="['fas', 'exclamation-triangle']"
        class="errorIcon"
      />
      <span class="errorText">{{ error }}</span>
    </div>

    <!-- Cookie 輸入區（未連接時顯示） -->
    <div
      v-if="!isConnected"
      class="cookieInputContainer"
    >
      <label
        for="cookieInput"
        class="cookieLabel"
      >
        {{ $t('Settings.YouTube Account Settings.Paste Your Cookie') }}:
      </label>
      <textarea
        id="cookieInput"
        v-model="cookieInput"
        class="cookieTextarea"
        :placeholder="$t('Settings.YouTube Account Settings.Cookie Placeholder')"
        rows="5"
        :disabled="isValidating"
      />
      <FtFlexBox class="buttonRow">
        <FtButton
          :label="$t('Settings.YouTube Account Settings.How to Get Cookie')"
          :icon="['fas', 'question-circle']"
          @click="showHelpDialog = true"
        />
        <FtButton
          :label="isValidating ? $t('Settings.YouTube Account Settings.Validating') : $t('Settings.YouTube Account Settings.Validate and Save')"
          :icon="['fas', isValidating ? 'spinner' : 'check']"
          :disabled="!cookieInput.trim() || isValidating"
          background-color="var(--primary-color)"
          text-color="var(--text-with-main-color)"
          @click="handleSaveCookie"
        />
      </FtFlexBox>
    </div>

    <!-- 已連接時的操作 -->
    <div
      v-else
      class="connectedActionsContainer"
    >
      <FtFlexBox>
        <FtButton
          :label="$t('Settings.YouTube Account Settings.Revalidate Cookie')"
          :icon="['fas', 'sync']"
          :disabled="isValidating"
          @click="handleRevalidate"
        />
        <FtButton
          :label="$t('Settings.YouTube Account Settings.Clear Cookie')"
          :icon="['fas', 'trash']"
          text-color="var(--destructive-text-color)"
          background-color="var(--destructive-color)"
          @click="showClearConfirm = true"
        />
      </FtFlexBox>
    </div>

    <!-- 安全提示 -->
    <div class="securityNotice">
      <font-awesome-icon
        :icon="['fas', 'shield-alt']"
        class="securityIcon"
      />
      <div class="securityText">
        <strong>{{ $t('Settings.YouTube Account Settings.Security Notice Title') }}</strong>
        <ul>
          <li>{{ $t('Settings.YouTube Account Settings.Security Notice 1') }}</li>
          <li>{{ $t('Settings.YouTube Account Settings.Security Notice 2') }}</li>
          <li>{{ $t('Settings.YouTube Account Settings.Security Notice 3') }}</li>
        </ul>
      </div>
    </div>

    <!-- 取得 Cookie 教學彈窗 -->
    <FtPrompt
      v-if="showHelpDialog"
      :label="helpDialogContent"
      :option-names="[$t('OK')]"
      :option-values="['ok']"
      @click="showHelpDialog = false"
    />

    <!-- 確認清除彈窗 -->
    <FtPrompt
      v-if="showClearConfirm"
      :label="$t('Settings.YouTube Account Settings.Clear Cookie Confirm')"
      :option-names="[$t('Yes, Delete'), $t('Cancel')]"
      :option-values="['delete', 'cancel']"
      is-first-option-destructive
      @click="handleClearConfirm"
    />
  </FtSettingsSection>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import { useI18n } from '../../composables/use-i18n-polyfill'

import FtButton from '../FtButton/FtButton.vue'
import FtFlexBox from '../ft-flex-box/ft-flex-box.vue'
import FtPrompt from '../FtPrompt/FtPrompt.vue'
import FtSettingsSection from '../FtSettingsSection/FtSettingsSection.vue'

import { showToast } from '../../helpers/utils'

const store = useStore()
const { t } = useI18n()

// 狀態
const cookieInput = ref('')
const showHelpDialog = ref(false)
const showClearConfirm = ref(false)

// Vuex state
const isConnected = computed(() => store.getters['youtubeAuth/isYouTubeConnected'])
const isValidating = computed(() => store.getters['youtubeAuth/isValidating'])
const accountName = computed(() => store.getters['youtubeAuth/youtubeAccountName'])
const error = computed(() => store.getters['youtubeAuth/authError'])
const connectionStatus = computed(() => store.getters['youtubeAuth/connectionStatus'])

// 狀態顯示
const connectionStatusClass = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'connected'
    case 'validating':
      return 'validating'
    case 'disconnected':
      return 'disconnected'
    default:
      return 'disabled'
  }
})

const statusIcon = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return ['fas', 'check-circle']
    case 'validating':
      return ['fas', 'spinner']
    case 'disconnected':
      return ['fas', 'times-circle']
    default:
      return ['fas', 'circle']
  }
})

const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return t('Settings.YouTube Account Settings.Connected')
    case 'validating':
      return t('Settings.YouTube Account Settings.Validating')
    case 'disconnected':
      return t('Settings.YouTube Account Settings.Disconnected')
    default:
      return t('Settings.YouTube Account Settings.Not Connected')
  }
})

// 教學內容
const helpDialogContent = computed(() => {
  return `${t('Settings.YouTube Account Settings.Help Title')}

1. ${t('Settings.YouTube Account Settings.Help Step 1')}

2. ${t('Settings.YouTube Account Settings.Help Step 2')}
   - Windows/Linux: F12 ${t('Settings.YouTube Account Settings.or')} Ctrl+Shift+I
   - macOS: Cmd+Option+I

3. ${t('Settings.YouTube Account Settings.Help Step 3')}

4. ${t('Settings.YouTube Account Settings.Help Step 4')}

5. ${t('Settings.YouTube Account Settings.Help Step 5')}

6. ${t('Settings.YouTube Account Settings.Help Step 6')}`
})

// 處理函數
async function handleSaveCookie() {
  if (!cookieInput.value.trim()) return

  const result = await store.dispatch('youtubeAuth/setYouTubeCookie', cookieInput.value)

  if (result.success) {
    showToast(t('Settings.YouTube Account Settings.Cookie Saved Successfully'))
    cookieInput.value = ''
  } else {
    showToast(result.error || t('Settings.YouTube Account Settings.Cookie Save Failed'), 5000, () => {})
  }
}

async function handleRevalidate() {
  const result = await store.dispatch('youtubeAuth/revalidateCookie')

  if (result.success) {
    showToast(t('Settings.YouTube Account Settings.Cookie Valid'))
  } else {
    showToast(result.error || t('Settings.YouTube Account Settings.Cookie Invalid'), 5000, () => {})
  }
}

async function handleClearConfirm(option) {
  showClearConfirm.value = false

  if (option !== 'delete') return

  await store.dispatch('youtubeAuth/clearYouTubeCookie')
  showToast(t('Settings.YouTube Account Settings.Cookie Cleared'))
}
</script>

<style scoped>
.description {
  margin-bottom: 16px;
  color: var(--secondary-text-color);
  line-height: 1.5;
}

.statusContainer {
  background-color: var(--card-bg-color);
  border: 1px solid var(--side-nav-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.statusRow,
.accountNameRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.accountNameRow {
  margin-top: 8px;
}

.statusLabel,
.accountLabel {
  font-weight: 500;
}

.statusValue {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.statusValue.connected {
  color: var(--success-color, #28a745);
}

.statusValue.validating {
  color: var(--warning-color, #ffc107);
}

.statusValue.disconnected {
  color: var(--destructive-color, #dc3545);
}

.statusValue.disabled {
  color: var(--secondary-text-color);
}

.statusIcon {
  font-size: 14px;
}

.accountName {
  color: var(--primary-text-color);
}

.errorContainer {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(220, 53, 69, 0.1);
  border: 1px solid var(--destructive-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.errorIcon {
  color: var(--destructive-color);
}

.errorText {
  color: var(--destructive-color);
}

.cookieInputContainer {
  margin-bottom: 16px;
}

.cookieLabel {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.cookieTextarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--side-nav-color);
  border-radius: 8px;
  background-color: var(--card-bg-color);
  color: var(--primary-text-color);
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
  margin-bottom: 12px;
}

.cookieTextarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.cookieTextarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.buttonRow {
  gap: 8px;
}

.connectedActionsContainer {
  margin-bottom: 16px;
}

.securityNotice {
  display: flex;
  gap: 12px;
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid var(--warning-color, #ffc107);
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.securityIcon {
  color: var(--warning-color, #ffc107);
  font-size: 20px;
  flex-shrink: 0;
}

.securityText {
  flex: 1;
}

.securityText strong {
  display: block;
  margin-bottom: 8px;
}

.securityText ul {
  margin: 0;
  padding-left: 20px;
}

.securityText li {
  margin-bottom: 4px;
  line-height: 1.4;
}
</style>
