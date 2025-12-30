/**
 * Onboarding Store Module
 * Manages first-time user onboarding state
 */

const state = {
  hasCompletedOnboarding: false,
  hasSeenTour: false,
  selectedInterests: [],
  // Track which onboarding steps have been completed
  completedSteps: {
    welcome: false,
    importSubscriptions: false,
    selectInterests: false,
    recommendedChannels: false
  }
}

const getters = {
  getHasCompletedOnboarding: (state) => state.hasCompletedOnboarding,
  getHasSeenTour: (state) => state.hasSeenTour,
  getSelectedInterests: (state) => state.selectedInterests,
  getCompletedSteps: (state) => state.completedSteps,
  isFirstTimeUser: (state) => !state.hasCompletedOnboarding && !state.hasSeenTour
}

const actions = {
  initOnboarding({ commit }) {
    // Load from localStorage
    const completed = localStorage.getItem('onboarding.completed')
    if (completed === 'true') {
      commit('SET_COMPLETED_ONBOARDING', true)
    }

    const seenTour = localStorage.getItem('onboarding.seenTour')
    if (seenTour === 'true') {
      commit('SET_SEEN_TOUR', true)
    }

    const interests = localStorage.getItem('onboarding.interests')
    if (interests) {
      try {
        commit('SET_SELECTED_INTERESTS', JSON.parse(interests))
      } catch (e) {
        // Ignore
      }
    }
  },

  completeOnboarding({ commit }) {
    commit('SET_COMPLETED_ONBOARDING', true)
    localStorage.setItem('onboarding.completed', 'true')
  },

  markTourAsSeen({ commit }) {
    commit('SET_SEEN_TOUR', true)
    localStorage.setItem('onboarding.seenTour', 'true')
  },

  setSelectedInterests({ commit }, interests) {
    commit('SET_SELECTED_INTERESTS', interests)
    localStorage.setItem('onboarding.interests', JSON.stringify(interests))
  },

  completeStep({ commit, state }, stepName) {
    commit('SET_STEP_COMPLETED', stepName)
  },

  resetOnboarding({ commit }) {
    commit('SET_COMPLETED_ONBOARDING', false)
    commit('SET_SEEN_TOUR', false)
    commit('SET_SELECTED_INTERESTS', [])
    commit('RESET_COMPLETED_STEPS')
    localStorage.removeItem('onboarding.completed')
    localStorage.removeItem('onboarding.seenTour')
    localStorage.removeItem('onboarding.interests')
  }
}

const mutations = {
  SET_COMPLETED_ONBOARDING(state, value) {
    state.hasCompletedOnboarding = value
  },

  SET_SEEN_TOUR(state, value) {
    state.hasSeenTour = value
  },

  SET_SELECTED_INTERESTS(state, interests) {
    state.selectedInterests = interests
  },

  SET_STEP_COMPLETED(state, stepName) {
    if (state.completedSteps[stepName] !== undefined) {
      state.completedSteps[stepName] = true
    }
  },

  RESET_COMPLETED_STEPS(state) {
    state.completedSteps = {
      welcome: false,
      importSubscriptions: false,
      selectInterests: false,
      recommendedChannels: false
    }
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
