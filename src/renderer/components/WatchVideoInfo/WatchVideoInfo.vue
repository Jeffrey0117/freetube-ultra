<template>
  <div class="watchVideoInfo">
    <!-- Video Title Section - Expandable on mobile -->
    <div class="videoTitleSection">
      <h1
        class="videoTitle"
        :class="{ expanded: isTitleExpanded }"
        dir="auto"
        @click="toggleTitleExpand"
      >
        {{ title }}
        <span
          v-if="isUnlisted"
          class="unlistedBadge"
        >
          {{ t('Video.Unlisted') }}
        </span>
      </h1>
    </div>

    <!-- Channel Info Row - YouTube Mobile Style -->
    <div class="channelMetaRow">
      <!-- Channel Avatar -->
      <RouterLink
        v-if="!hideUploader"
        :to="`/channel/${channelId}`"
        class="channelThumbnailLink"
      >
        <img
          :src="channelThumbnail"
          class="channelThumbnailSmall"
          alt=""
        >
      </RouterLink>

      <!-- Channel Name + Meta inline -->
      <div class="channelMetaInline">
        <RouterLink
          v-if="!hideUploader"
          :to="`/channel/${channelId}`"
          class="channelNameInline"
          dir="auto"
        >
          {{ channelName }}
        </RouterLink>
        <span class="metaText">
          <span v-if="!hideVideoViews && parsedViewCount">
            {{ parsedViewCount }}
          </span>
          <span v-if="!hideVideoViews && parsedViewCount" class="metaDot">·</span>
          <span>{{ dateString }}</span>
        </span>
        <button
          class="showMoreBtn"
          type="button"
        >
          ...{{ t('Video.Show More') || '顯示更多' }}
        </button>
      </div>
    </div>

    <!-- Action Buttons Row - YouTube Style Horizontal Scroll -->
    <div class="actionButtonsRow">
      <!-- Channel Avatar (duplicate for action row on mobile) -->
      <RouterLink
        v-if="!hideUploader"
        :to="`/channel/${channelId}`"
        class="actionRowAvatar"
      >
        <img
          :src="channelThumbnail"
          class="actionRowAvatarImg"
          alt=""
        >
      </RouterLink>

      <!-- Bell/Subscribe Button -->
      <FtSubscribeButton
        v-if="!hideUnsubscribeButton && !hideUploader"
        :channel-id="channelId"
        :channel-name="channelName"
        :channel-thumbnail="channelThumbnail"
        :subscription-count-text="subscriptionCountText"
        class="subscribeButtonCompact"
      />

      <!-- Like/Dislike Pill -->
      <div
        v-if="!hideVideoLikesAndDislikes && parsedLikeCount !== null"
        class="likeDislikePill"
      >
        <button
          class="likeButton"
          type="button"
        >
          <FontAwesomeIcon
            :icon="['fas', 'thumbs-up']"
            class="likeIcon"
          />
          <span>{{ parsedLikeCount }}</span>
        </button>
        <button
          class="dislikeButton"
          type="button"
        >
          <FontAwesomeIcon
            :icon="['fas', 'thumbs-up']"
            class="dislikeIcon"
          />
        </button>
      </div>

      <!-- Share Button -->
      <FtShareButton
        v-if="!hideSharingActions"
        :id="id"
        :get-timestamp="getTimestamp"
        :playlist-id="playlistId"
        class="actionButton"
      />

      <!-- Save/Bookmark Button -->
      <FtIconButton
        v-if="isQuickBookmarkEnabled"
        :title="quickBookmarkIconText"
        :icon="isInQuickBookmarkPlaylist ? ['fas', 'check'] : ['fas', 'bookmark']"
        class="actionButton"
        :class="{
          bookmarked: isInQuickBookmarkPlaylist,
        }"
        :theme="quickBookmarkIconTheme"
        @click="toggleQuickBookmarked"
      />

      <!-- Add to Playlist -->
      <FtIconButton
        v-if="showPlaylists && !isUpcoming"
        :title="t('User Playlists.Add to Playlist')"
        :icon="['fas', 'plus']"
        theme="secondary"
        class="actionButton"
        @click="togglePlaylistPrompt"
      />

      <!-- Download Button -->
      <FtIconButton
        v-if="!isUpcoming && downloadLinks.length > 0"
        ref="downloadButton"
        :title="t('Video.Download Video')"
        theme="secondary"
        :icon="['fas', 'download']"
        :return-index="true"
        :dropdown-options="downloadLinks"
        class="actionButton"
        @click="handleDownload"
      />
    </div>

    <!-- Legacy Desktop Layout (hidden on mobile via CSS) -->
    <div class="channelActionsRow desktopOnly">
      <!-- Channel Info Section -->
      <div
        v-if="!hideUploader"
        class="channelInfoSection"
      >
        <RouterLink
          :to="`/channel/${channelId}`"
          class="channelThumbnailLink"
        >
          <img
            :src="channelThumbnail"
            class="channelThumbnail"
            alt=""
          >
        </RouterLink>
        <div class="channelDetails">
          <RouterLink
            :to="`/channel/${channelId}`"
            class="channelName"
            dir="auto"
          >
            {{ channelName }}
          </RouterLink>
          <FtSubscribeButton
            v-if="!hideUnsubscribeButton"
            :channel-id="channelId"
            :channel-name="channelName"
            :channel-thumbnail="channelThumbnail"
            :subscription-count-text="subscriptionCountText"
          />
        </div>
      </div>

      <!-- Action Buttons Section -->
      <div class="actionButtonsSection">
        <!-- Like/Dislike Pill -->
        <div
          v-if="!hideVideoLikesAndDislikes && parsedLikeCount !== null"
          class="likeDislikePill"
        >
          <button
            class="likeButton"
            type="button"
          >
            <FontAwesomeIcon
              :icon="['fas', 'thumbs-up']"
              class="likeIcon"
            />
            <span>{{ parsedLikeCount }}</span>
          </button>
          <button
            class="dislikeButton"
            type="button"
          >
            <FontAwesomeIcon
              :icon="['fas', 'thumbs-up']"
              class="dislikeIcon"
            />
          </button>
        </div>

        <!-- Share Button -->
        <FtShareButton
          v-if="!hideSharingActions"
          :id="id"
          :get-timestamp="getTimestamp"
          :playlist-id="playlistId"
          class="actionButton"
        />

        <!-- Download Button -->
        <FtIconButton
          v-if="!isUpcoming && downloadLinks.length > 0"
          ref="downloadButton"
          :title="t('Video.Download Video')"
          theme="secondary"
          :icon="['fas', 'download']"
          :return-index="true"
          :dropdown-options="downloadLinks"
          class="actionButton"
          @click="handleDownload"
        />

        <!-- Add to Playlist -->
        <FtIconButton
          v-if="showPlaylists && !isUpcoming"
          :title="t('User Playlists.Add to Playlist')"
          :icon="['fas', 'plus']"
          theme="secondary"
          class="actionButton"
          @click="togglePlaylistPrompt"
        />

        <!-- Quick Bookmark -->
        <FtIconButton
          v-if="isQuickBookmarkEnabled"
          :title="quickBookmarkIconText"
          :icon="isInQuickBookmarkPlaylist ? ['fas', 'check'] : ['fas', 'bookmark']"
          class="actionButton quickBookmarkVideoIcon"
          :class="{
            bookmarked: isInQuickBookmarkPlaylist,
          }"
          :theme="quickBookmarkIconTheme"
          @click="toggleQuickBookmarked"
        />
      </div>
    </div>

    <!-- More Options Row -->
    <div class="moreOptionsRow">
      <FtIconButton
        v-if="canSaveWatchedProgress && watchedProgressSavingInSemiAutoMode"
        :title="t('Video.Save Watched Progress')"
        :icon="['fas', 'bars-progress']"
        theme="secondary"
        class="actionButton"
        @click="saveWatchedProgressManually"
      />

      <FtIconButton
        v-if="USING_ELECTRON && externalPlayer !== ''"
        :title="t('Video.External Player.OpenInTemplate', { externalPlayer })"
        :icon="['fas', 'external-link-alt']"
        theme="secondary"
        class="actionButton"
        @click="handleExternalPlayer"
      />

      <FtIconButton
        v-if="!isUpcoming"
        :title="t('Change Format.Change Media Formats')"
        theme="secondary"
        :icon="['fas', 'file-video']"
        :dropdown-options="formatTypeOptions"
        class="actionButton"
        @click="changeFormat"
      />
    </div>
  </div>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from '../../composables/use-i18n-polyfill'

import FtIconButton from '../FtIconButton/FtIconButton.vue'
import FtShareButton from '../FtShareButton/FtShareButton.vue'
import FtSubscribeButton from '../FtSubscribeButton/FtSubscribeButton.vue'

import store from '../../store'

import { formatNumber, openExternalLink, showToast } from '../../helpers/utils'

// Mobile title expand state
const isTitleExpanded = ref(false)

function toggleTitleExpand() {
  isTitleExpanded.value = !isTitleExpanded.value
}

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  channelName: {
    type: String,
    required: true
  },
  channelThumbnail: {
    type: String,
    required: true
  },
  published: {
    type: Number,
    required: true
  },
  premiereDate: {
    type: Date,
    default: undefined
  },
  viewCount: {
    type: Number,
    default: null
  },
  subscriptionCountText: {
    type: String,
    required: true
  },
  likeCount: {
    type: Number,
    default: 0
  },
  dislikeCount: {
    type: Number,
    default: 0
  },
  getTimestamp: {
    type: Function,
    required: true
  },
  isLive: {
    type: Boolean,
    required: false
  },
  isLiveContent: {
    type: Boolean,
    required: true
  },
  isUpcoming: {
    type: Boolean,
    required: true
  },
  downloadLinks: {
    type: Array,
    required: true
  },
  playlistId: {
    type: String,
    default: null
  },
  getPlaylistIndex: {
    type: Function,
    required: true
  },
  getPlaylistReverse: {
    type: Function,
    required: true
  },
  getPlaylistShuffle: {
    type: Function,
    required: true
  },
  getPlaylistLoop: {
    type: Function,
    required: true
  },
  lengthSeconds: {
    type: Number,
    required: true
  },
  videoThumbnail: {
    type: String,
    required: true
  },
  inUserPlaylist: {
    type: Boolean,
    required: true
  },
  isUnlisted: {
    type: Boolean,
    required: false
  },
  canSaveWatchedProgress: {
    type: Boolean,
    required: true
  },
})

const emit = defineEmits([
  'change-format',
  'pause-player',
  'set-info-area-sticky',
  'scroll-to-info-area',
  'save-watched-progress',
])

const USING_ELECTRON = process.env.IS_ELECTRON

const { locale, t } = useI18n()

/** @type {import('vue').ComputedRef<boolean>} */
const hideSharingActions = computed(() => store.getters.getHideSharingActions)

/** @type {import('vue').ComputedRef<boolean>} */
const hideUnsubscribeButton = computed(() => store.getters.getHideUnsubscribeButton)

/** @type {import('vue').ComputedRef<boolean>} */
const hideUploader = computed(() => store.getters.getHideUploader)

/** @type {import('vue').ComputedRef<boolean>} */
const hideVideoLikesAndDislikes = computed(() => store.getters.getHideVideoLikesAndDislikes)

const parsedLikeCount = computed(() => {
  if (hideVideoLikesAndDislikes.value || props.likeCount === null) {
    return null
  }

  return formatNumber(props.likeCount)
})

/** @type {import('vue').ComputedRef<boolean>} */
const hideVideoViews = computed(() => store.getters.getHideVideoViews)

const parsedViewCount = computed(() => {
  if (hideVideoViews.value || props.viewCount == null) {
    return null
  }

  return t('Global.Counts.View Count', { count: formatNumber(props.viewCount) }, props.viewCount)
})

const dateString = computed(() => {
  const formatter = new Intl.DateTimeFormat([locale.value, 'en'], { dateStyle: 'medium' })
  const localeDateString = formatter.format(props.published)
  // replace spaces with no break spaces to make the date act as a single entity while wrapping
  return localeDateString.replaceAll(' ', '\u00A0')
})

const publishedString = computed(() => {
  if (props.isLive) {
    return t('Video.Started streaming on')
  } else if (props.isLiveContent && !props.isLive) {
    return t('Video.Streamed on')
  } else {
    return t('Video.Published on')
  }
})

const formatTypeOptions = computed(() => [
  {
    label: t('Change Format.Use Dash Formats'),
    value: 'dash'
  },
  {
    label: t('Change Format.Use Legacy Formats'),
    value: 'legacy'
  },
  {
    label: t('Change Format.Use Audio Formats'),
    value: 'audio'
  }
])

/**
 * @param {'dash' | 'legacy' | 'audio'} value
 */
function changeFormat(value) {
  emit('change-format', value)
}

const watchedProgressSavingInSemiAutoMode = computed(() => {
  return store.getters.getWatchedProgressSavingMode === 'semi-auto'
})

function saveWatchedProgressManually() {
  emit('save-watched-progress')
}

/** @type {import('vue').ComputedRef<boolean>} */
const rememberHistory = computed(() => store.getters.getRememberHistory)

const historyEntryExists = computed(() => store.getters.getHistoryCacheById[props.id] !== undefined)

/** @type {import('vue').ComputedRef<string>} */
const externalPlayer = computed(() => store.getters.getExternalPlayer)

/** @type {import('vue').ComputedRef<number>} */
const defaultPlayback = computed(() => store.getters.getDefaultPlayback)

function handleExternalPlayer() {
  emit('pause-player')

  let payload

  // Only play video in non playlist mode when user playlist detected
  if (props.inUserPlaylist) {
    payload = {
      videoId: props.id,
      startTime: props.getTimestamp(),
      playbackRate: defaultPlayback.value,
    }
  } else {
    payload = {
      videoId: props.id,
      playlistId: props.playlistId,
      startTime: props.getTimestamp(),
      playbackRate: defaultPlayback.value,
      playlistIndex: props.getPlaylistIndex(),
      playlistReverse: props.getPlaylistReverse(),
      playlistShuffle: props.getPlaylistShuffle(),
      playlistLoop: props.getPlaylistLoop()
    }
  }

  if (process.env.IS_ELECTRON) {
    window.ftElectron.openInExternalPlayer(payload)
  }

  if (rememberHistory.value) {
    // Marking as watched
    const videoData = {
      videoId: props.id,
      title: props.title,
      author: props.channelName,
      authorId: props.channelId,
      published: props.published,
      description: props.description,
      viewCount: props.viewCount,
      lengthSeconds: props.lengthSeconds,
      watchProgress: 0,
      timeWatched: Date.now(),
      isLive: false,
      type: 'video'
    }

    store.dispatch('updateHistory', videoData)

    if (!historyEntryExists.value) {
      showToast(t('Video.Video has been marked as watched'))
    }
  }
}

const downloadButton = useTemplateRef('downloadButton')

/** @type {import('vue').WatchHandle | undefined} */
let downloadDropdownWatcher

onMounted(() => {
  if (process.env.IS_ELECTRON || 'mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: props.title,
      artist: props.channelName,
      artwork: [{
        src: props.videoThumbnail,
        sizes: '128x128',
        type: 'img/png'
      }]
    })
  }

  // live and post-live DVR don't have a download button
  if (downloadButton.value) {
    downloadDropdownWatcher = watch(() => downloadButton.value.dropdownShown, (dropdownShown) => {
      emit('set-info-area-sticky', !dropdownShown)

      if (dropdownShown && window.innerWidth >= 901) {
        // adds a slight delay so we know that the dropdown has shown up
        // and won't mess up our scrolling
        nextTick(() => {
          emit('scroll-to-info-area')
        })
      }
    })
  }
})

onBeforeUnmount(() => {
  if (downloadDropdownWatcher) {
    downloadDropdownWatcher.stop()
    downloadDropdownWatcher = undefined
  }
})

/** @type {import('vue').ComputedRef<'download' | 'open'>} */
const downloadBehavior = computed(() => store.getters.getDownloadBehavior)

/**
 * @param {number} index
 */
function handleDownload(index) {
  const selectedDownloadLinkOption = props.downloadLinks[index]
  const mimeTypeUrl = selectedDownloadLinkOption.value.split('||')

  if (!process.env.IS_ELECTRON || downloadBehavior.value === 'open') {
    openExternalLink(mimeTypeUrl[1])
  } else {
    store.dispatch('downloadMedia', {
      url: mimeTypeUrl[1],
      title: props.title,
      mimeType: mimeTypeUrl[0]
    })
  }
}

const showPlaylists = computed(() => !store.getters.getHidePlaylists)

function togglePlaylistPrompt() {
  const videoData = {
    videoId: props.id,
    title: props.title,
    author: props.channelName,
    authorId: props.channelId,
    description: props.description,
    viewCount: props.viewCount,
    lengthSeconds: props.lengthSeconds,
    published: props.published,
    premiereDate: props.premiereDate
  }

  store.dispatch('showAddToPlaylistPromptForManyVideos', { videos: [videoData] })
}

const quickBookmarkPlaylist = computed(() => store.getters.getQuickBookmarkPlaylist)

const isQuickBookmarkEnabled = computed(() => quickBookmarkPlaylist.value != null)

const isInQuickBookmarkPlaylist = computed(() => {
  if (!isQuickBookmarkEnabled.value) { return false }

  // Accessing a reactive property has a negligible amount of overhead,
  // however as we know that some users have playlists that have more than 10k items in them
  // it adds up quickly. So create a temporary variable outside of the array, so we only have to do it once.
  // Also the search is retriggered every time any playlist is modified.
  const id = props.id

  return quickBookmarkPlaylist.value.videos.some((video) => {
    return video.videoId === id
  })
})

const quickBookmarkIconText = computed(() => {
  if (!isQuickBookmarkEnabled.value) { return '' }

  const translationProperties = {
    playlistName: quickBookmarkPlaylist.value.playlistName,
  }
  return isInQuickBookmarkPlaylist.value
    ? t('User Playlists.Remove from Favorites', translationProperties)
    : t('User Playlists.Add to Favorites', translationProperties)
})

const quickBookmarkIconTheme = computed(() => isInQuickBookmarkPlaylist.value ? 'base favorite' : 'base')

function toggleQuickBookmarked() {
  if (!isQuickBookmarkEnabled.value) {
    // This should be prevented by UI
    return
  }

  if (isInQuickBookmarkPlaylist.value) {
    removeFromQuickBookmarkPlaylist()
  } else {
    addToQuickBookmarkPlaylist()
  }
}

function addToQuickBookmarkPlaylist() {
  const videoData = {
    videoId: props.id,
    title: props.title,
    author: props.channelName,
    authorId: props.channelId,
    lengthSeconds: props.lengthSeconds,
    published: props.published,
    premiereDate: props.premiereDate
  }

  store.dispatch('addVideo', {
    _id: quickBookmarkPlaylist.value._id,
    videoData,
  })

  // TODO: Maybe show playlist name
  showToast(t('Video.Video has been saved'))
}

function removeFromQuickBookmarkPlaylist() {
  store.dispatch('removeVideo', {
    _id: quickBookmarkPlaylist.value._id,
    // Remove all playlist items with same videoId
    videoId: props.id,
  })

  // TODO: Maybe show playlist name
  showToast(t('Video.Video has been removed from your saved list'))
}
</script>

<style scoped src="./WatchVideoInfo.css" />
