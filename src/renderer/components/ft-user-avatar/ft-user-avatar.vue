<template>
  <div
    class="ft-user-avatar"
    :class="[sizeClass, { clickable: clickable, loading: isLoading }]"
    :title="alt"
    @click="handleClick"
  >
    <!-- 載入中狀態 -->
    <div
      v-if="isLoading"
      class="avatar-skeleton"
    />

    <!-- 頭像圖片 -->
    <img
      v-else-if="avatarUrl && !hasError"
      :src="avatarUrl"
      :alt="alt"
      class="avatar-image"
      @error="handleImageError"
      @load="handleImageLoad"
    >

    <!-- 預設頭像（使用首字母） -->
    <div
      v-else
      class="avatar-fallback"
      :style="{ backgroundColor: fallbackColor }"
    >
      <span class="avatar-initial">{{ initial }}</span>
    </div>

    <!-- 線上狀態指示器 -->
    <div
      v-if="showStatus"
      class="avatar-status"
      :class="statusClass"
    />
  </div>
</template>

<script setup>
/**
 * FtUserAvatar - 用戶頭像元件
 *
 * 功能：
 * - 顯示用戶頭像圖片
 * - 支援不同尺寸 (small, medium, large)
 * - 圖片載入失敗時顯示首字母
 * - 點擊事件支援
 * - 載入狀態動畫
 */

import { ref, computed } from 'vue'

// 元件屬性定義
const props = defineProps({
  // 頭像圖片 URL
  src: {
    type: String,
    default: ''
  },
  // 替代文字（用於無障礙和首字母）
  alt: {
    type: String,
    default: 'User'
  },
  // 尺寸：small (32px), medium (48px), large (80px), xlarge (120px)
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large', 'xlarge'].includes(value)
  },
  // 是否可點擊
  clickable: {
    type: Boolean,
    default: false
  },
  // 是否顯示狀態指示器
  showStatus: {
    type: Boolean,
    default: false
  },
  // 狀態類型：online, offline, syncing
  status: {
    type: String,
    default: 'offline',
    validator: (value) => ['online', 'offline', 'syncing'].includes(value)
  },
  // 自訂背景色（用於預設頭像）
  backgroundColor: {
    type: String,
    default: ''
  }
})

// 事件定義
const emit = defineEmits(['click', 'error', 'load'])

// 響應式狀態
const isLoading = ref(!!props.src)
const hasError = ref(false)

// 計算屬性：頭像 URL
const avatarUrl = computed(() => {
  return props.src || ''
})

// 計算屬性：尺寸 CSS 類別
const sizeClass = computed(() => {
  return `size-${props.size}`
})

// 計算屬性：狀態 CSS 類別
const statusClass = computed(() => {
  return `status-${props.status}`
})

// 計算屬性：首字母（用於預設頭像）
const initial = computed(() => {
  if (!props.alt) return '?'
  // 取得第一個非空白字元
  const trimmed = props.alt.trim()
  if (!trimmed) return '?'
  // 返回首字母（大寫）
  return trimmed.charAt(0).toUpperCase()
})

// 計算屬性：預設頭像背景色
const fallbackColor = computed(() => {
  if (props.backgroundColor) return props.backgroundColor
  // 根據 alt 文字生成一致的顏色
  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffc107', '#ff9800', '#ff5722', '#795548'
  ]
  const hash = props.alt.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
  return colors[Math.abs(hash) % colors.length]
})

// 事件處理：點擊
function handleClick(event) {
  if (props.clickable) {
    emit('click', event)
  }
}

// 事件處理：圖片載入錯誤
function handleImageError(event) {
  hasError.value = true
  isLoading.value = false
  emit('error', event)
}

// 事件處理：圖片載入完成
function handleImageLoad(event) {
  isLoading.value = false
  emit('load', event)
}
</script>

<style scoped>
/* 頭像容器基礎樣式 */
.ft-user-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--scrollbar-color);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

/* 可點擊狀態 */
.ft-user-avatar.clickable {
  cursor: pointer;
}

.ft-user-avatar.clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.ft-user-avatar.clickable:active {
  transform: scale(0.98);
}

/* 尺寸變化 */
.ft-user-avatar.size-small {
  width: 32px;
  height: 32px;
}

.ft-user-avatar.size-medium {
  width: 48px;
  height: 48px;
}

.ft-user-avatar.size-large {
  width: 80px;
  height: 80px;
}

.ft-user-avatar.size-xlarge {
  width: 120px;
  height: 120px;
}

/* 頭像圖片 */
.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 載入骨架動畫 */
.avatar-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--scrollbar-color) 25%,
    var(--secondary-card-bg-color) 50%,
    var(--scrollbar-color) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 預設頭像（首字母） */
.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-initial {
  color: #ffffff;
  font-weight: 600;
  text-transform: uppercase;
  user-select: none;
}

/* 根據尺寸調整首字母大小 */
.size-small .avatar-initial {
  font-size: 14px;
}

.size-medium .avatar-initial {
  font-size: 18px;
}

.size-large .avatar-initial {
  font-size: 32px;
}

.size-xlarge .avatar-initial {
  font-size: 48px;
}

/* 狀態指示器 */
.avatar-status {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--card-bg-color);
}

.size-small .avatar-status {
  width: 8px;
  height: 8px;
  bottom: 0;
  right: 0;
  border-width: 1.5px;
}

.size-large .avatar-status,
.size-xlarge .avatar-status {
  width: 16px;
  height: 16px;
  bottom: 4px;
  right: 4px;
  border-width: 3px;
}

/* 狀態顏色 */
.status-online {
  background-color: #4caf50;
}

.status-offline {
  background-color: #9e9e9e;
}

.status-syncing {
  background-color: #ffc107;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
