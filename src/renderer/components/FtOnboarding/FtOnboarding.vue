<template>
  <div
    v-if="showOnboarding"
    class="onboarding-overlay"
  >
    <div class="onboarding-dialog">
      <!-- Step 1: Welcome -->
      <div
        v-if="currentStep === 'welcome'"
        class="onboarding-step"
      >
        <h1 class="onboarding-title">
          {{ t('Onboarding.Welcome to FreeTube') }}
        </h1>
        <p class="onboarding-subtitle">
          {{ t('Onboarding.A private YouTube experience') }}
        </p>

        <div class="onboarding-options">
          <button
            class="onboarding-btn primary"
            @click="startImport"
          >
            <span class="btn-icon">📥</span>
            <span class="btn-text">
              <strong>{{ t('Onboarding.Import from YouTube') }}</strong>
              <small>{{ t('Onboarding.Bring your subscriptions') }}</small>
            </span>
          </button>

          <button
            class="onboarding-btn"
            @click="goToInterests"
          >
            <span class="btn-icon">🎯</span>
            <span class="btn-text">
              <strong>{{ t('Onboarding.Choose Interests') }}</strong>
              <small>{{ t('Onboarding.Get personalized recommendations') }}</small>
            </span>
          </button>

          <button
            class="onboarding-btn"
            @click="skipToApp"
          >
            <span class="btn-icon">🔍</span>
            <span class="btn-text">
              <strong>{{ t('Onboarding.Start Exploring') }}</strong>
              <small>{{ t('Onboarding.Search and browse freely') }}</small>
            </span>
          </button>
        </div>

        <button
          class="skip-btn"
          @click="completeOnboarding"
        >
          {{ t('Onboarding.Skip for now') }}
        </button>
      </div>

      <!-- Step 2: Import Instructions -->
      <div
        v-if="currentStep === 'import'"
        class="onboarding-step"
      >
        <button
          class="back-btn"
          @click="currentStep = 'welcome'"
        >
          ← {{ t('Onboarding.Back') }}
        </button>

        <h2 class="onboarding-title">
          {{ t('Onboarding.Import Your Subscriptions') }}
        </h2>

        <div class="import-methods">
          <div class="import-method">
            <h3>{{ t('Onboarding.Method 1: Google Takeout') }} ({{ t('Onboarding.Recommended') }})</h3>
            <ol>
              <li>{{ t('Onboarding.Go to Google Takeout') }}</li>
              <li>{{ t('Onboarding.Select YouTube data') }}</li>
              <li>{{ t('Onboarding.Download and extract') }}</li>
              <li>{{ t('Onboarding.Import the subscriptions file') }}</li>
            </ol>
            <button
              class="onboarding-btn primary small"
              @click="openGoogleTakeout"
            >
              {{ t('Onboarding.Open Google Takeout') }}
            </button>
          </div>

          <div class="import-method">
            <h3>{{ t('Onboarding.Method 2: Paste Channel URL') }}</h3>
            <p>{{ t('Onboarding.Paste a YouTube channel URL in the search box') }}</p>
            <input
              v-model="channelUrl"
              type="text"
              class="url-input"
              :placeholder="t('Onboarding.Paste YouTube channel URL')"
              @keydown.enter="addChannelFromUrl"
            >
            <button
              class="onboarding-btn small"
              :disabled="!channelUrl"
              @click="addChannelFromUrl"
            >
              {{ t('Onboarding.Add Channel') }}
            </button>
          </div>
        </div>

        <div class="import-actions">
          <button
            class="onboarding-btn"
            @click="goToSettings"
          >
            {{ t('Onboarding.Go to Import Settings') }}
          </button>
          <button
            class="onboarding-btn secondary"
            @click="goToInterests"
          >
            {{ t('Onboarding.Skip to Interests') }}
          </button>
        </div>
      </div>

      <!-- Step 3: Interest Selection -->
      <div
        v-if="currentStep === 'interests'"
        class="onboarding-step"
      >
        <button
          class="back-btn"
          @click="currentStep = 'welcome'"
        >
          ← {{ t('Onboarding.Back') }}
        </button>

        <h2 class="onboarding-title">
          {{ t('Onboarding.What are you interested in?') }}
        </h2>
        <p class="onboarding-subtitle">
          {{ t('Onboarding.Select categories to get channel recommendations') }}
        </p>

        <div class="interest-grid">
          <button
            v-for="interest in availableInterests"
            :key="interest.id"
            class="interest-btn"
            :class="{ selected: selectedInterests.includes(interest.id) }"
            @click="toggleInterest(interest.id)"
          >
            <span class="interest-icon">{{ interest.icon }}</span>
            <span class="interest-name">{{ t(`Onboarding.Interest.${interest.id}`) }}</span>
          </button>
        </div>

        <div class="interest-actions">
          <button
            class="onboarding-btn primary"
            :disabled="selectedInterests.length === 0"
            @click="goToRecommendations"
          >
            {{ t('Onboarding.See Recommendations') }} ({{ selectedInterests.length }})
          </button>
          <button
            class="skip-btn"
            @click="completeOnboarding"
          >
            {{ t('Onboarding.Skip') }}
          </button>
        </div>
      </div>

      <!-- Step 4: Channel Recommendations -->
      <div
        v-if="currentStep === 'recommendations'"
        class="onboarding-step"
      >
        <button
          class="back-btn"
          @click="currentStep = 'interests'"
        >
          ← {{ t('Onboarding.Back') }}
        </button>

        <h2 class="onboarding-title">
          {{ t('Onboarding.Recommended Channels') }}
        </h2>
        <p class="onboarding-subtitle">
          {{ t('Onboarding.Select channels to subscribe') }}
        </p>

        <div class="channel-list">
          <div
            v-for="channel in recommendedChannels"
            :key="channel.id"
            class="channel-item"
            :class="{ selected: selectedChannels.includes(channel.id) }"
            @click="toggleChannel(channel.id)"
          >
            <div class="channel-checkbox">
              <span v-if="selectedChannels.includes(channel.id)">✓</span>
            </div>
            <img
              :src="channel.thumbnail"
              :alt="channel.name"
              class="channel-thumb"
            >
            <div class="channel-info">
              <span class="channel-name">{{ channel.name }}</span>
              <span class="channel-subs">{{ channel.subscribers }}</span>
            </div>
            <span class="channel-category">{{ t(`Onboarding.Interest.${channel.category}`) }}</span>
          </div>
        </div>

        <div class="recommendation-actions">
          <button
            class="onboarding-btn primary"
            :disabled="selectedChannels.length === 0"
            @click="subscribeToChannels"
          >
            {{ t('Onboarding.Subscribe to Selected') }} ({{ selectedChannels.length }})
          </button>
          <button
            class="onboarding-btn secondary"
            @click="completeOnboarding"
          >
            {{ t('Onboarding.Start Without Subscribing') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '../../composables/use-i18n-polyfill'
import store from '../../store/index'
import { openExternalLink } from '../../helpers/utils'

const { t } = useI18n()
const router = useRouter()

const showOnboarding = ref(false)
const currentStep = ref('welcome')
const channelUrl = ref('')
const selectedInterests = ref([])
const selectedChannels = ref([])

// Available interest categories
const availableInterests = [
  { id: 'music', icon: '🎵' },
  { id: 'gaming', icon: '🎮' },
  { id: 'tech', icon: '💻' },
  { id: 'education', icon: '📚' },
  { id: 'entertainment', icon: '🎬' },
  { id: 'news', icon: '📰' },
  { id: 'sports', icon: '⚽' },
  { id: 'cooking', icon: '🍳' },
  { id: 'travel', icon: '✈️' },
  { id: 'science', icon: '🔬' },
  { id: 'art', icon: '🎨' },
  { id: 'fitness', icon: '💪' }
]

// Curated channel recommendations by category
const curatedChannels = {
  tech: [
    { id: 'UCBJycsmduvYEL83R_U4JriQ', name: 'Marques Brownlee', subscribers: '19M', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UCXuqSBlHAE6Xw-yeJA0Tunw', name: 'Linus Tech Tips', subscribers: '15M', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UCVHFbqXqoYvEWM1Ddxl0QKg', name: 'Android Authority', subscribers: '3M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  gaming: [
    { id: 'UCOpNcN46UbXVtpKMrmU4Abg', name: 'Game Theory', subscribers: '17M', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UCam8T03EOFBsNdR0thrFHdQ', name: 'FLAVOR', subscribers: '3M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  music: [
    { id: 'UC-9-kyTW8ZkZNDHQJ6FgpwQ', name: 'YouTube Music', subscribers: '100M+', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UCuAXFkgsw1L7xaCfnd5JJOw', name: 'Rick Beato', subscribers: '4M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  education: [
    { id: 'UCsXVk37bltHxD1rDPwtNM8Q', name: 'Kurzgesagt', subscribers: '23M', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', name: 'Veritasium', subscribers: '15M', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UC6nSFpj9HTCZ5t-N3Rm3-HA', name: 'Vsauce', subscribers: '18M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  science: [
    { id: 'UCZYTClx2T1of7BRZ86-8fow', name: 'SciShow', subscribers: '7M', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UCvjgEDvShRsAIm0IXAJ1QRA', name: 'Mark Rober', subscribers: '26M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  entertainment: [
    { id: 'UCY1kMZp36IQSyNx_9h4mpCg', name: 'MrBeast', subscribers: '200M+', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  cooking: [
    { id: 'UCRIZtPl9nb9RiXc9btSTQNw', name: 'Gordon Ramsay', subscribers: '20M', thumbnail: '/vi/placeholder/default.jpg' },
    { id: 'UCJFp8uSYCjXOMnkUyb3CQ3Q', name: 'Tasty', subscribers: '21M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  fitness: [
    { id: 'UCe0TLA0EsQbE-MjuHXevj2A', name: 'ATHLEAN-X', subscribers: '13M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  news: [
    { id: 'UCupvZG-5ko_eiXAupbDfxWw', name: 'CNN', subscribers: '15M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  sports: [
    { id: 'UCWOA1ZGywLbqmigxE4Qlvuw', name: 'ESPN', subscribers: '9M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  travel: [
    { id: 'UCt_NLJ4McJlCyYM-dSPRo7Q', name: 'Kara and Nate', subscribers: '4M', thumbnail: '/vi/placeholder/default.jpg' }
  ],
  art: [
    { id: 'UCHu2KNu6TtJ0p4hpSW7Yv7Q', name: 'Jazza', subscribers: '6M', thumbnail: '/vi/placeholder/default.jpg' }
  ]
}

// Computed: Get channels based on selected interests
const recommendedChannels = computed(() => {
  const channels = []
  for (const interest of selectedInterests.value) {
    const categoryChannels = curatedChannels[interest] || []
    for (const channel of categoryChannels) {
      if (!channels.find(c => c.id === channel.id)) {
        channels.push({ ...channel, category: interest })
      }
    }
  }
  return channels
})

onMounted(() => {
  // Initialize onboarding state
  store.dispatch('initOnboarding')

  // Check if first time user
  const isFirstTime = store.getters.isFirstTimeUser

  // Also check if user has any subscriptions
  const subscriptions = store.getters.getAllSubscriptionsList || []
  const hasNoSubscriptions = subscriptions.length === 0

  // Show onboarding if first time OR has no subscriptions and hasn't completed onboarding
  if (isFirstTime || (hasNoSubscriptions && !store.getters.getHasCompletedOnboarding)) {
    showOnboarding.value = true
  }
})

function toggleInterest(interestId) {
  const index = selectedInterests.value.indexOf(interestId)
  if (index === -1) {
    selectedInterests.value.push(interestId)
  } else {
    selectedInterests.value.splice(index, 1)
  }
}

function toggleChannel(channelId) {
  const index = selectedChannels.value.indexOf(channelId)
  if (index === -1) {
    selectedChannels.value.push(channelId)
  } else {
    selectedChannels.value.splice(index, 1)
  }
}

function startImport() {
  currentStep.value = 'import'
}

function goToInterests() {
  currentStep.value = 'interests'
}

function goToRecommendations() {
  // Save selected interests
  store.dispatch('setSelectedInterests', selectedInterests.value)

  // Pre-select all recommended channels
  selectedChannels.value = recommendedChannels.value.map(c => c.id)

  currentStep.value = 'recommendations'
}

function skipToApp() {
  completeOnboarding()
  router.push('/trending')
}

function openGoogleTakeout() {
  openExternalLink('https://takeout.google.com/settings/takeout/custom/youtube')
}

function goToSettings() {
  completeOnboarding()
  router.push('/settings/data-settings')
}

async function addChannelFromUrl() {
  if (!channelUrl.value) return

  try {
    // Parse the URL and navigate to channel
    const result = await store.dispatch('getYoutubeUrlInfo', channelUrl.value)
    if (result.urlType === 'channel') {
      router.push(`/channel/${result.channelId}`)
      completeOnboarding()
    }
  } catch (e) {
    console.error('Invalid channel URL:', e)
  }

  channelUrl.value = ''
}

async function subscribeToChannels() {
  // Subscribe to selected channels
  for (const channelId of selectedChannels.value) {
    const channel = recommendedChannels.value.find(c => c.id === channelId)
    if (channel) {
      try {
        await store.dispatch('subscribeToChannel', {
          channelId: channelId,
          channelName: channel.name,
          channelThumbnailUrl: channel.thumbnail
        })
      } catch (e) {
        console.error('Failed to subscribe to channel:', channelId, e)
      }
    }
  }

  completeOnboarding()
  router.push('/subscriptions')
}

function completeOnboarding() {
  store.dispatch('completeOnboarding')
  store.dispatch('markTourAsSeen')
  showOnboarding.value = false
}
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.onboarding-dialog {
  background: var(--bg-color, #1a1a2e);
  border-radius: 16px;
  padding: 32px;
  max-width: 600px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.onboarding-step {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.onboarding-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-color, #fff);
}

.onboarding-subtitle {
  font-size: 16px;
  color: var(--secondary-text-color, #888);
  margin-bottom: 24px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary-color, #f44);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 16px;
  padding: 0;
}

.back-btn:hover {
  text-decoration: underline;
}

.onboarding-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.onboarding-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border: 2px solid var(--card-border-color, #333);
  border-radius: 12px;
  background: var(--card-bg-color, #222);
  color: var(--text-color, #fff);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.onboarding-btn:hover {
  border-color: var(--primary-color, #f44);
  transform: translateY(-2px);
}

.onboarding-btn.primary {
  background: var(--primary-color, #f44);
  border-color: var(--primary-color, #f44);
  color: #fff;
}

.onboarding-btn.primary:hover {
  filter: brightness(1.1);
}

.onboarding-btn.secondary {
  background: transparent;
}

.onboarding-btn.small {
  padding: 10px 16px;
  font-size: 14px;
}

.onboarding-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  font-size: 24px;
}

.btn-text {
  display: flex;
  flex-direction: column;
}

.btn-text strong {
  font-size: 16px;
}

.btn-text small {
  font-size: 13px;
  color: var(--secondary-text-color, #888);
}

.skip-btn {
  background: none;
  border: none;
  color: var(--secondary-text-color, #888);
  font-size: 14px;
  cursor: pointer;
  margin-top: 16px;
}

.skip-btn:hover {
  color: var(--text-color, #fff);
}

/* Import Methods */
.import-methods {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.import-method {
  background: var(--card-bg-color, #222);
  border-radius: 12px;
  padding: 16px;
}

.import-method h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text-color, #fff);
}

.import-method ol {
  margin: 0 0 12px 20px;
  color: var(--secondary-text-color, #888);
  font-size: 14px;
}

.import-method li {
  margin-bottom: 4px;
}

.url-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--card-border-color, #333);
  border-radius: 8px;
  background: var(--bg-color, #1a1a2e);
  color: var(--text-color, #fff);
  font-size: 14px;
  margin-bottom: 8px;
}

.url-input:focus {
  outline: none;
  border-color: var(--primary-color, #f44);
}

.import-actions {
  display: flex;
  gap: 12px;
}

/* Interest Grid */
.interest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.interest-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid var(--card-border-color, #333);
  border-radius: 12px;
  background: var(--card-bg-color, #222);
  color: var(--text-color, #fff);
  cursor: pointer;
  transition: all 0.2s ease;
}

.interest-btn:hover {
  border-color: var(--primary-color, #f44);
}

.interest-btn.selected {
  border-color: var(--primary-color, #f44);
  background: rgba(255, 68, 68, 0.1);
}

.interest-icon {
  font-size: 28px;
}

.interest-name {
  font-size: 12px;
  font-weight: 500;
}

.interest-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

/* Channel List */
.channel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
  max-height: 300px;
  overflow-y: auto;
}

.channel-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid var(--card-border-color, #333);
  border-radius: 10px;
  background: var(--card-bg-color, #222);
  cursor: pointer;
  transition: all 0.2s ease;
}

.channel-item:hover {
  border-color: var(--primary-color, #f44);
}

.channel-item.selected {
  border-color: var(--primary-color, #f44);
  background: rgba(255, 68, 68, 0.1);
}

.channel-checkbox {
  width: 24px;
  height: 24px;
  border: 2px solid var(--card-border-color, #444);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--primary-color, #f44);
}

.channel-item.selected .channel-checkbox {
  background: var(--primary-color, #f44);
  border-color: var(--primary-color, #f44);
  color: #fff;
}

.channel-thumb {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--card-border-color, #333);
}

.channel-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.channel-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #fff);
}

.channel-subs {
  font-size: 12px;
  color: var(--secondary-text-color, #888);
}

.channel-category {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--primary-color, #f44);
  color: #fff;
}

.recommendation-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
