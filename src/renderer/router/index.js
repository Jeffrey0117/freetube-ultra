import { createRouter, createWebHashHistory } from 'vue-router'
import Subscriptions from '../views/Subscriptions/Subscriptions.vue'
import SubscribedChannels from '../views/SubscribedChannels/SubscribedChannels.vue'
import ProfileSettings from '../views/ProfileSettings/ProfileSettings.vue'
import Trending from '../views/Trending/Trending.vue'
import Popular from '../views/Popular/Popular.vue'
import UserPlaylists from '../views/UserPlaylists/UserPlaylists.vue'
import History from '../views/History/History.vue'
import Settings from '../views/Settings/Settings.vue'
import About from '../views/About/About.vue'
import SearchPage from '../views/SearchPage/SearchPage.vue'
import Playlist from '../views/Playlist/Playlist.vue'
import Channel from '../views/Channel/Channel.vue'
import Watch from '../views/Watch/Watch.vue'
import Hashtag from '../views/Hashtag/Hashtag.vue'
import Post from '../views/Post.vue'
import MusicPlayer from '../components/MusicPlayer/MusicPlayer.vue'
import MusicHome from '../views/Music/MusicHome.vue'

// YouTube Theme (MeeTube)
import YtDemo from '../views/YtDemo/YtDemo.vue'
import YtWatch from '../views/YtWatch/YtWatch.vue'
import YtSearch from '../views/YtSearch/YtSearch.vue'
import YtMusicHome from '../views/YtMusic/YtMusicHome.vue'
import YtMusicPlayer from '../views/YtMusic/YtMusicPlayer.vue'
import YtFavorites from '../views/YtFavorites/YtFavorites.vue'
import YtCourses from '../views/YtCourses/YtCourses.vue'
import YtCourseDetail from '../views/YtCourses/YtCourseDetail.vue'
import YtChannel from '../views/YtChannel/YtChannel.vue'
import YtSubscriptions from '../views/YtSubscriptions/YtSubscriptions.vue'

// 會員系統相關頁面
import Profile from '../views/Profile/Profile.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'default',
      meta: {
        title: 'Most Popular'
      },
      component: Popular
    },
    {
      path: '/subscriptions',
      name: 'subscriptions',
      meta: {
        title: 'Subscriptions'
      },
      component: Subscriptions,
      // Web 模式下重導向到 Popular (訂閱功能需要本地資料庫)
      beforeEnter: (to, from, next) => {
        if (!process.env.SUPPORTS_LOCAL_API) {
          next({ name: 'popular' })
        } else {
          next()
        }
      }
    },
    {
      path: '/subscribedchannels',
      name: 'subscribedChannels',
      meta: {
        title: 'Channels'
      },
      component: SubscribedChannels,
      // Web 模式下重導向到 Popular
      beforeEnter: (to, from, next) => {
        if (!process.env.SUPPORTS_LOCAL_API) {
          next({ name: 'popular' })
        } else {
          next()
        }
      }
    },
    {
      // Trending 現在在 Web 和 Electron 模式都可用
      path: '/trending',
      name: 'trending',
      meta: {
        title: 'Trending'
      },
      component: Trending
    },
    {
      path: '/popular',
      name: 'popular',
      meta: {
        title: 'Most Popular'
      },
      component: Popular
    },
    {
      path: '/userplaylists',
      name: 'userPlaylists',
      meta: {
        title: 'Your Playlists'
      },
      component: UserPlaylists
    },
    {
      path: '/history',
      name: 'history',
      meta: {
        title: 'History'
      },
      component: History
    },
    {
      path: '/settings',
      name: 'settings',
      meta: {
        title: 'Settings'
      },
      component: Settings
    },
    {
      path: '/about',
      name: 'about',
      meta: {
        title: 'About'
      },
      component: About
    },
    {
      path: '/settings/profile',
      name: 'profileSettings',
      meta: {
        title: 'Profile Settings'
      },
      component: ProfileSettings
    },
    {
      path: '/search/:query',
      meta: {
        title: 'Search Results'
      },
      component: SearchPage
    },
    {
      path: '/playlist/:id',
      meta: {
        title: 'Playlist'
      },
      component: Playlist
    },
    {
      path: '/channel/:id/:currentTab?',
      meta: {
        title: 'Channel'
      },
      component: Channel
    },
    {
      path: '/watch/:id',
      meta: {
        title: 'Watch'
      },
      component: Watch
    },
    {
      path: '/hashtag/:hashtag',
      meta: {
        title: 'Hashtag'
      },
      component: Hashtag
    },
    {
      path: '/post/:id',
      meta: {
        title: 'Post',
      },
      component: Post
    },
    // Music Mode Routes
    {
      path: '/music',
      name: 'musicHome',
      meta: {
        title: 'Music'
      },
      component: MusicHome
    },
    {
      path: '/music/trending',
      name: 'musicTrending',
      meta: {
        title: 'Trending Music'
      },
      component: MusicHome // TODO: Create dedicated trending page
    },
    {
      path: '/music/search',
      name: 'musicSearch',
      meta: {
        title: 'Search Music'
      },
      component: MusicHome // TODO: Create dedicated search page
    },
    {
      path: '/music/library',
      name: 'musicLibrary',
      meta: {
        title: 'Music Library'
      },
      component: MusicHome // TODO: Create dedicated library page
    },
    {
      path: '/music/play/:id',
      name: 'musicPlay',
      meta: {
        title: 'Now Playing'
      },
      component: MusicPlayer
    },
    {
      path: '/music/channel/:id',
      name: 'musicChannel',
      meta: {
        title: 'Artist'
      },
      component: Channel // 暫時使用 Channel，可加上音樂模式專用 UI
    },

    // ==================== 會員系統路由 ====================
    {
      path: '/profile',
      name: 'profile',
      meta: {
        title: 'My Profile',
        requiresAuth: true
      },
      component: Profile
    },
    {
      path: '/login',
      name: 'login',
      meta: {
        title: 'Login'
      },
      // 使用動態導入以減少初始載入時間
      component: () => import('../views/Login/Login.vue')
    },
    {
      path: '/register',
      name: 'register',
      meta: {
        title: 'Register'
      },
      // 使用動態導入以減少初始載入時間
      component: () => import('../views/Register/Register.vue')
    },
    {
      path: '/switch-user',
      name: 'switchUser',
      meta: {
        title: 'Switch Account'
      },
      // 使用動態導入以減少初始載入時間
      component: () => import('../views/SwitchUser/SwitchUser.vue')
    },

    // ==================== YouTube Theme (MeeTube) ====================
    {
      path: '/yt',
      name: 'ytHome',
      meta: {
        title: 'MeeTube'
      },
      component: YtDemo
    },
    {
      path: '/yt/watch/:id',
      name: 'ytWatch',
      meta: {
        title: '觀看影片'
      },
      component: YtWatch
    },
    {
      path: '/yt/search/:query',
      name: 'ytSearch',
      meta: {
        title: '搜尋結果'
      },
      component: YtSearch
    },
    {
      path: '/yt/channel/:id/:currentTab?',
      name: 'ytChannel',
      meta: {
        title: '頻道'
      },
      component: YtChannel
    },
    {
      path: '/yt/trending',
      name: 'ytTrending',
      meta: {
        title: '發燒影片'
      },
      component: YtDemo // TODO: Create dedicated trending page
    },
    {
      path: '/yt/subscriptions',
      name: 'ytSubscriptions',
      meta: {
        title: '訂閱內容'
      },
      component: YtSubscriptions
    },
    {
      path: '/yt/history',
      name: 'ytHistory',
      meta: {
        title: '觀看記錄'
      },
      component: YtDemo // TODO: Create dedicated history page
    },
    {
      path: '/yt/library',
      name: 'ytLibrary',
      meta: {
        title: '媒體庫'
      },
      component: YtDemo // TODO: Create dedicated library page
    },
    {
      path: '/yt/playlists',
      name: 'ytPlaylists',
      meta: {
        title: '播放清單'
      },
      component: YtDemo // TODO: Create dedicated playlists page
    },
    {
      path: '/yt/settings',
      name: 'ytSettings',
      meta: {
        title: '設定'
      },
      component: YtDemo // TODO: Create dedicated settings page
    },
    // MeeTube Favorites
    {
      path: '/yt/favorites',
      name: 'ytFavorites',
      meta: {
        title: '我的收藏'
      },
      component: YtFavorites
    },
    // MeeTube Courses
    {
      path: '/yt/courses',
      name: 'ytCourses',
      meta: {
        title: '我的課程'
      },
      component: YtCourses
    },
    {
      path: '/yt/courses/:id',
      name: 'ytCourseDetail',
      meta: {
        title: '課程詳情'
      },
      component: YtCourseDetail
    },
    // MeeTube Music Mode
    {
      path: '/yt/music',
      name: 'ytMusic',
      meta: {
        title: 'MeeTube Music'
      },
      component: YtMusicHome
    },
    {
      path: '/yt/music/play/:id',
      name: 'ytMusicPlay',
      meta: {
        title: '正在播放'
      },
      component: YtMusicPlayer
    },
    {
      path: '/yt/music/search',
      name: 'ytMusicSearch',
      meta: {
        title: '搜尋音樂'
      },
      component: YtMusicHome // Reuse home with search mode
    }
  ],
  scrollBehavior(to, from, savedPosition) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (savedPosition !== null) {
          resolve(savedPosition)
        } else {
          resolve({ left: 0, top: 0 })
        }
      }, 500)
    })
  }
})

export default router
