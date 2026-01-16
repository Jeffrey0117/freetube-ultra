<template>
  <div class="profile-page">
    <!-- 頁面頭部：用戶資訊 -->
    <div class="profile-header">
      <!-- 頭像區域（可點擊更換） -->
      <div class="avatar-section">
        <ft-user-avatar
          :src="userAvatar"
          :alt="displayName"
          size="xlarge"
          :clickable="true"
          @click="openAvatarPicker"
        />
        <button
          class="change-avatar-btn"
          :title="$t('Profile.Change Avatar')"
          @click="openAvatarPicker"
        >
          <font-awesome-icon :icon="['fas', 'camera']" />
        </button>

        <!-- 隱藏的文件輸入 -->
        <input
          ref="avatarInput"
          type="file"
          accept="image/*"
          class="hidden-input"
          @change="handleAvatarChange"
        >
      </div>

      <!-- 用戶資訊 -->
      <div class="user-info">
        <h1 class="display-name">{{ displayName }}</h1>
        <span class="username">@{{ username }}</span>
        <span class="join-date">
          <font-awesome-icon :icon="['fas', 'calendar-alt']" />
          {{ $t('Profile.Joined') }} {{ formattedJoinDate }}
        </span>
      </div>

      <!-- 編輯按鈕 -->
      <button
        class="edit-profile-btn"
        @click="openEditModal"
      >
        <font-awesome-icon :icon="['fas', 'pen']" />
        {{ $t('Profile.Edit Profile') }}
      </button>
    </div>

    <!-- 統計數據卡片 -->
    <div class="stats-grid">
      <div
        class="stat-card"
        @click="setActiveTab('subscriptions')"
      >
        <span class="stat-value">{{ subscriptionCount }}</span>
        <span class="stat-label">{{ $t('Profile.Subscriptions') }}</span>
        <font-awesome-icon
          :icon="['fas', 'users']"
          class="stat-icon"
        />
      </div>

      <div
        class="stat-card"
        @click="setActiveTab('playlists')"
      >
        <span class="stat-value">{{ playlistCount }}</span>
        <span class="stat-label">{{ $t('Profile.Playlists') }}</span>
        <font-awesome-icon
          :icon="['fas', 'list']"
          class="stat-icon"
        />
      </div>

      <div
        class="stat-card"
        @click="setActiveTab('history')"
      >
        <span class="stat-value">{{ historyCount }}</span>
        <span class="stat-label">{{ $t('Profile.History') }}</span>
        <font-awesome-icon
          :icon="['fas', 'history']"
          class="stat-icon"
        />
      </div>

      <div class="stat-card">
        <span class="stat-value">{{ formattedWatchTime }}</span>
        <span class="stat-label">{{ $t('Profile.Watch Time') }}</span>
        <font-awesome-icon
          :icon="['fas', 'clock']"
          class="stat-icon"
        />
      </div>
    </div>

    <!-- Tab 導航 -->
    <div class="tab-navigation">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-button"
        :class="{ active: activeTab === tab.id }"
        @click="setActiveTab(tab.id)"
      >
        <font-awesome-icon
          :icon="tab.icon"
          class="tab-icon"
        />
        <span class="tab-label">{{ $t(tab.label) }}</span>
      </button>
    </div>

    <!-- Tab 內容區域 -->
    <div class="tab-content">
      <!-- 訂閱 Tab -->
      <div
        v-show="activeTab === 'subscriptions'"
        class="tab-panel"
      >
        <div
          v-if="subscriptions.length === 0"
          class="empty-state"
        >
          <font-awesome-icon
            :icon="['fas', 'users']"
            class="empty-icon"
          />
          <p>{{ $t('Profile.No subscriptions yet') }}</p>
          <button
            class="action-btn"
            @click="$router.push('/trending')"
          >
            {{ $t('Profile.Discover Channels') }}
          </button>
        </div>
        <div
          v-else
          class="subscription-list"
        >
          <div
            v-for="channel in subscriptions"
            :key="channel.id"
            class="subscription-item"
            @click="navigateToChannel(channel.id)"
          >
            <img
              :src="channel.thumbnail"
              :alt="channel.name"
              class="channel-thumbnail"
            >
            <span class="channel-name">{{ channel.name }}</span>
          </div>
        </div>
      </div>

      <!-- 播放清單 Tab -->
      <div
        v-show="activeTab === 'playlists'"
        class="tab-panel"
      >
        <div
          v-if="playlists.length === 0"
          class="empty-state"
        >
          <font-awesome-icon
            :icon="['fas', 'list']"
            class="empty-icon"
          />
          <p>{{ $t('Profile.No playlists yet') }}</p>
          <button
            class="action-btn"
            @click="$router.push('/userplaylists')"
          >
            {{ $t('Profile.Create Playlist') }}
          </button>
        </div>
        <div
          v-else
          class="playlist-grid"
        >
          <div
            v-for="playlist in playlists"
            :key="playlist._id"
            class="playlist-card"
            @click="navigateToPlaylist(playlist._id)"
          >
            <div class="playlist-thumbnail">
              <font-awesome-icon :icon="['fas', 'play-circle']" />
              <span class="video-count">{{ playlist.videos?.length || 0 }}</span>
            </div>
            <span class="playlist-name">{{ playlist.playlistName }}</span>
          </div>
        </div>
      </div>

      <!-- 歷史 Tab -->
      <div
        v-show="activeTab === 'history'"
        class="tab-panel"
      >
        <div
          v-if="history.length === 0"
          class="empty-state"
        >
          <font-awesome-icon
            :icon="['fas', 'history']"
            class="empty-icon"
          />
          <p>{{ $t('Profile.No history yet') }}</p>
          <button
            class="action-btn"
            @click="$router.push('/trending')"
          >
            {{ $t('Profile.Start Watching') }}
          </button>
        </div>
        <div
          v-else
          class="history-list"
        >
          <div
            v-for="video in recentHistory"
            :key="video.videoId"
            class="history-item"
            @click="navigateToVideo(video.videoId)"
          >
            <div class="video-thumbnail-wrapper">
              <img
                :src="getVideoThumbnail(video.videoId)"
                :alt="video.title"
                class="video-thumbnail"
              >
              <span class="video-duration">{{ formatDuration(video.lengthSeconds) }}</span>
            </div>
            <div class="video-info">
              <span class="video-title">{{ video.title }}</span>
              <span class="video-channel">{{ video.author }}</span>
              <span class="watched-at">{{ formatWatchedAt(video.timeWatched) }}</span>
            </div>
          </div>
          <button
            v-if="history.length > 10"
            class="view-all-btn"
            @click="$router.push('/history')"
          >
            {{ $t('Profile.View All History') }}
          </button>
        </div>
      </div>

      <!-- 設定 Tab -->
      <div
        v-show="activeTab === 'settings'"
        class="tab-panel"
      >
        <div class="settings-section">
          <h3 class="section-title">{{ $t('Profile.Account') }}</h3>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ $t('Profile.Change Password') }}</span>
              <span class="setting-description">{{ $t('Profile.Update your account password') }}</span>
            </div>
            <button
              class="setting-btn"
              @click="openChangePassword"
            >
              <font-awesome-icon :icon="['fas', 'key']" />
            </button>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ $t('Profile.Export Data') }}</span>
              <span class="setting-description">{{ $t('Profile.Download your data') }}</span>
            </div>
            <button
              class="setting-btn"
              @click="exportData"
            >
              <font-awesome-icon :icon="['fas', 'download']" />
            </button>
          </div>

          <div class="setting-item danger">
            <div class="setting-info">
              <span class="setting-label">{{ $t('Profile.Delete Account') }}</span>
              <span class="setting-description">{{ $t('Profile.Permanently delete your account') }}</span>
            </div>
            <button
              class="setting-btn danger"
              @click="confirmDeleteAccount"
            >
              <font-awesome-icon :icon="['fas', 'trash-alt']" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 編輯個人檔案 Modal -->
    <div
      v-if="showEditModal"
      class="modal-overlay"
      @click.self="closeEditModal"
    >
      <div class="modal-dialog">
        <div class="modal-header">
          <h2>{{ $t('Profile.Edit Profile') }}</h2>
          <button
            class="modal-close"
            @click="closeEditModal"
          >
            <font-awesome-icon :icon="['fas', 'times']" />
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label for="edit-display-name">{{ $t('Profile.Display Name') }}</label>
            <input
              id="edit-display-name"
              v-model="editForm.displayName"
              type="text"
              class="form-input"
              :placeholder="$t('Profile.Enter display name')"
            >
          </div>

          <div class="form-group">
            <label for="edit-username">{{ $t('Profile.Username') }}</label>
            <input
              id="edit-username"
              v-model="editForm.username"
              type="text"
              class="form-input"
              :placeholder="$t('Profile.Enter username')"
              disabled
            >
            <span class="form-hint">{{ $t('Profile.Username cannot be changed') }}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="btn-secondary"
            @click="closeEditModal"
          >
            {{ $t('Profile.Cancel') }}
          </button>
          <button
            class="btn-primary"
            @click="saveProfile"
          >
            {{ $t('Profile.Save Changes') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./Profile.js" />
<style scoped src="./Profile.css" />
