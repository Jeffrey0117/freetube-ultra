/**
 * Profile.js - 個人檔案頁面邏輯
 *
 * 功能：
 * - 從 Vuex 取得用戶資料
 * - 計算統計數據
 * - 處理頭像更換
 * - Tab 切換邏輯
 * - 編輯個人檔案
 */

import { defineComponent, ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import FtUserAvatar from '../../components/ft-user-avatar/ft-user-avatar.vue'

export default defineComponent({
  name: 'Profile',

  components: {
    FtUserAvatar
  },

  setup() {
    const store = useStore()
    const router = useRouter()

    // ============ 響應式狀態 ============

    // 當前選中的 Tab
    const activeTab = ref('subscriptions')

    // 編輯 Modal 顯示狀態
    const showEditModal = ref(false)

    // 編輯表單數據
    const editForm = ref({
      displayName: '',
      username: ''
    })

    // 頭像輸入元素引用
    const avatarInput = ref(null)

    // Tab 配置
    const tabs = [
      { id: 'subscriptions', label: 'Profile.Subscriptions', icon: ['fas', 'users'] },
      { id: 'playlists', label: 'Profile.Playlists', icon: ['fas', 'list'] },
      { id: 'history', label: 'Profile.History', icon: ['fas', 'history'] },
      { id: 'settings', label: 'Profile.Settings', icon: ['fas', 'cog'] }
    ]

    // ============ 計算屬性 ============

    // 當前用戶資料
    const currentUser = computed(() => {
      return store.getters['user/currentUser'] || {
        username: 'guest',
        displayName: '',
        avatar: '',
        createdAt: Date.now()
      }
    })

    // 用戶頭像
    const userAvatar = computed(() => currentUser.value.avatar || '')

    // 顯示名稱
    const displayName = computed(() => {
      return currentUser.value.displayName || currentUser.value.username || 'User'
    })

    // 用戶名
    const username = computed(() => currentUser.value.username || 'guest')

    // 格式化的加入日期
    const formattedJoinDate = computed(() => {
      const date = new Date(currentUser.value.createdAt || Date.now())
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    })

    // 訂閱列表
    const subscriptions = computed(() => {
      // 從 profiles 模組取得訂閱
      const activeProfile = store.getters.getActiveProfile
      return activeProfile?.subscriptions || []
    })

    // 訂閱數量
    const subscriptionCount = computed(() => subscriptions.value.length)

    // 播放清單列表
    const playlists = computed(() => {
      return store.getters.getAllPlaylists || []
    })

    // 播放清單數量
    const playlistCount = computed(() => playlists.value.length)

    // 觀看歷史
    const history = computed(() => {
      return store.getters.getHistoryCache || []
    })

    // 歷史數量
    const historyCount = computed(() => history.value.length)

    // 最近的歷史記錄（最多顯示 10 筆）
    const recentHistory = computed(() => {
      return history.value.slice(0, 10)
    })

    // 總觀看時間（從用戶統計或計算）
    const totalWatchTime = computed(() => {
      // 從用戶統計取得
      const stats = currentUser.value.stats || {}
      if (stats.totalWatchTime) return stats.totalWatchTime

      // 否則從歷史記錄計算
      return history.value.reduce((total, video) => {
        return total + (video.watchProgress || 0)
      }, 0)
    })

    // 格式化的觀看時間
    const formattedWatchTime = computed(() => {
      const seconds = totalWatchTime.value
      if (seconds < 60) return `${seconds}s`
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
      const hours = Math.floor(seconds / 3600)
      if (hours < 24) return `${hours}h`
      const days = Math.floor(hours / 24)
      return `${days}d`
    })

    // ============ 方法 ============

    // 設定當前 Tab
    function setActiveTab(tabId) {
      activeTab.value = tabId
    }

    // 打開頭像選擇器
    function openAvatarPicker() {
      avatarInput.value?.click()
    }

    // 處理頭像更換
    async function handleAvatarChange(event) {
      const file = event.target.files?.[0]
      if (!file) return

      // 驗證文件類型
      if (!file.type.startsWith('image/')) {
        console.error('Invalid file type')
        return
      }

      // 驗證文件大小（最大 5MB）
      if (file.size > 5 * 1024 * 1024) {
        console.error('File too large')
        return
      }

      try {
        // 讀取文件為 base64
        const reader = new FileReader()
        reader.onload = async (e) => {
          const base64 = e.target?.result
          if (base64) {
            // 更新用戶頭像
            await store.dispatch('user/updateProfile', {
              avatar: base64
            })
          }
        }
        reader.readAsDataURL(file)
      } catch (error) {
        console.error('Failed to update avatar:', error)
      }

      // 清空輸入以允許重複選擇同一文件
      event.target.value = ''
    }

    // 打開編輯 Modal
    function openEditModal() {
      editForm.value = {
        displayName: currentUser.value.displayName || '',
        username: currentUser.value.username || ''
      }
      showEditModal.value = true
    }

    // 關閉編輯 Modal
    function closeEditModal() {
      showEditModal.value = false
    }

    // 保存個人檔案
    async function saveProfile() {
      try {
        await store.dispatch('user/updateProfile', {
          displayName: editForm.value.displayName
        })
        closeEditModal()
      } catch (error) {
        console.error('Failed to save profile:', error)
      }
    }

    // 導航到頻道
    function navigateToChannel(channelId) {
      router.push(`/channel/${channelId}`)
    }

    // 導航到播放清單
    function navigateToPlaylist(playlistId) {
      router.push(`/playlist/${playlistId}`)
    }

    // 導航到影片
    function navigateToVideo(videoId) {
      router.push(`/watch/${videoId}`)
    }

    // 取得影片縮圖
    function getVideoThumbnail(videoId) {
      return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    }

    // 格式化時長
    function formatDuration(seconds) {
      if (!seconds) return '0:00'
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      }
      return `${m}:${s.toString().padStart(2, '0')}`
    }

    // 格式化觀看時間
    function formatWatchedAt(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now.getTime() - date.getTime()

      // 小於 1 小時
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000)
        return `${minutes} minutes ago`
      }

      // 小於 24 小時
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000)
        return `${hours} hours ago`
      }

      // 小於 7 天
      if (diff < 604800000) {
        const days = Math.floor(diff / 86400000)
        return `${days} days ago`
      }

      // 其他情況顯示日期
      return date.toLocaleDateString()
    }

    // 打開更改密碼對話框
    function openChangePassword() {
      // TODO: 實作更改密碼對話框
      console.log('Open change password dialog')
    }

    // 導出資料
    function exportData() {
      // TODO: 實作資料導出
      console.log('Export data')
    }

    // 確認刪除帳戶
    function confirmDeleteAccount() {
      // TODO: 實作刪除帳戶確認對話框
      console.log('Confirm delete account')
    }

    // ============ 生命週期 ============

    onMounted(() => {
      // 檢查是否已登入
      const isLoggedIn = store.getters['user/isLoggedIn']
      if (!isLoggedIn) {
        // 未登入則重導向到登入頁面
        router.push('/login')
      }
    })

    // ============ 返回 ============

    return {
      // 狀態
      activeTab,
      showEditModal,
      editForm,
      avatarInput,
      tabs,

      // 計算屬性
      userAvatar,
      displayName,
      username,
      formattedJoinDate,
      subscriptions,
      subscriptionCount,
      playlists,
      playlistCount,
      history,
      historyCount,
      recentHistory,
      formattedWatchTime,

      // 方法
      setActiveTab,
      openAvatarPicker,
      handleAvatarChange,
      openEditModal,
      closeEditModal,
      saveProfile,
      navigateToChannel,
      navigateToPlaylist,
      navigateToVideo,
      getVideoThumbnail,
      formatDuration,
      formatWatchedAt,
      openChangePassword,
      exportData,
      confirmDeleteAccount
    }
  }
})
