import { base64EncodeUtf8, createWebURL, fetchWithTimeout, randomArrayItem } from '../../helpers/utils'

// 運行時檢測 API URL (支援 Cloudflare Tunnel 遠程訪問)
// 網頁版使用相對路徑，透過 webpack proxy 代理到本地 API Server
function getInitialApiUrl() {
  if (typeof window !== 'undefined' && window.location) {
    // 非 localhost 時使用當前 hostname (例如 Cloudflare Tunnel)
    if (window.location.hostname !== 'localhost') {
      return `${window.location.protocol}//${window.location.hostname}`
    }
    // localhost 時使用空字串，讓請求變成相對路徑，透過 webpack proxy
    return ''
  }
  return 'http://localhost:3001'
}

const initialApiUrl = getInitialApiUrl()

const state = {
  currentInvidiousInstance: initialApiUrl,
  currentInvidiousInstanceAuthorization: null,
  currentInvidiousInstanceUrl: initialApiUrl,
  invidiousInstancesList: null
}

const getters = {
  getCurrentInvidiousInstance(state) {
    return state.currentInvidiousInstance
  },

  getCurrentInvidiousInstanceUrl(state) {
    return state.currentInvidiousInstanceUrl
  },

  getCurrentInvidiousInstanceAuthorization(state) {
    return state.currentInvidiousInstanceAuthorization
  },

  getInvidiousInstancesList(state) {
    return state.invidiousInstancesList
  }
}

const actions = {
  async fetchInvidiousInstancesFromFile({ commit }) {
    const url = createWebURL('/static/invidious-instances.json')

    const fileData = await (await fetch(url)).json()
    const instances = fileData.filter(e => {
      return process.env.SUPPORTS_LOCAL_API || e.cors
    }).map(e => {
      return e.url
    })

    commit('setInvidiousInstancesList', instances)
  },

  /// fetch invidious instances from site and overwrite static file.
  async fetchInvidiousInstances({ commit }) {
    const requestUrl = 'https://api.invidious.io/instances.json'
    try {
      const response = await fetchWithTimeout(15_000, requestUrl)
      const json = await response.json()
      const instances = json.filter((instance) => {
        return !(instance[0].includes('.onion') ||
          instance[0].includes('.i2p') ||
          !instance[1].api ||
          (!process.env.SUPPORTS_LOCAL_API && !instance[1].cors))
      }).map((instance) => {
        return instance[1].uri.replace(/\/$/, '')
      })

      if (instances.length !== 0) {
        commit('setInvidiousInstancesList', instances)
      } else {
        console.warn('using static file for invidious instances')
      }
    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.error('Fetching the Invidious instance list timed out after 15 seconds. Falling back to local copy.')
      } else {
        console.error(err)
      }
    }
  },

  setRandomCurrentInvidiousInstance({ commit, state }) {
    const instanceList = state.invidiousInstancesList
    commit('setCurrentInvidiousInstance', randomArrayItem(instanceList))
  }
}

const mutations = {
  setCurrentInvidiousInstance(state, value) {
    state.currentInvidiousInstance = value

    let url
    try {
      url = new URL(value)
    } catch { }

    let authorization = null

    if (url && (url.username.length > 0 || url.password.length > 0)) {
      authorization = `Basic ${base64EncodeUtf8(`${url.username}:${url.password}`)}`
    }

    state.currentInvidiousInstanceAuthorization = authorization

    let instanceUrl

    if (url && authorization) {
      url.username = ''
      url.password = ''

      instanceUrl = url.toString().replace(/\/$/, '')
    } else {
      instanceUrl = value
    }

    state.currentInvidiousInstanceUrl = instanceUrl

    if (process.env.IS_ELECTRON) {
      if (authorization) {
        window.ftElectron.setInvidiousAuthorization(authorization, instanceUrl)
      } else {
        window.ftElectron.clearInvidiousAuthorization()
      }
    }
  },

  setInvidiousInstancesList(state, value) {
    state.invidiousInstancesList = value
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
