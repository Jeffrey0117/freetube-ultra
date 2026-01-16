/**
 * FreeTube Router Guards
 * Vue Router 路由守衛
 * @module src/renderer/router/guards
 */

import store from '../store'

/**
 * 需要登入的路由守衛
 * 若用戶未登入，重導向到登入頁面
 *
 * @param {Object} to - 目標路由物件
 * @param {Object} from - 來源路由物件
 * @param {Function} next - 導航控制函數
 *
 * @example
 * // 在路由定義中使用
 * {
 *   path: '/profile',
 *   component: Profile,
 *   beforeEnter: requireAuth
 * }
 */
export function requireAuth(to, from, next) {
  // 檢查用戶是否已登入
  const isLoggedIn = store.getters['user/isLoggedIn']

  if (isLoggedIn) {
    // 已登入，允許導航
    next()
  } else {
    // 未登入，重導向到登入頁面
    // 保存原本要前往的路由，登入後可以返回
    next({
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    })
  }
}

/**
 * 已登入時重定向的守衛
 * 若用戶已登入，重導向到個人檔案頁面（或其他指定頁面）
 *
 * @param {Object} to - 目標路由物件
 * @param {Object} from - 來源路由物件
 * @param {Function} next - 導航控制函數
 *
 * @example
 * // 在路由定義中使用（用於登入/註冊頁面）
 * {
 *   path: '/login',
 *   component: Login,
 *   beforeEnter: redirectIfAuthenticated
 * }
 */
export function redirectIfAuthenticated(to, from, next) {
  // 檢查用戶是否已登入
  const isLoggedIn = store.getters['user/isLoggedIn']

  if (isLoggedIn) {
    // 已登入，重導向到個人檔案頁面
    next('/profile')
  } else {
    // 未登入，允許導航
    next()
  }
}

/**
 * 條件式認證守衛工廠函數
 * 根據自訂條件決定是否允許導航
 *
 * @param {Function} condition - 條件函數，接收 store 和 to 路由，返回布林值
 * @param {string|Object} redirectTo - 條件不符時的重導向目標
 * @returns {Function} - 路由守衛函數
 *
 * @example
 * // 自訂條件：需要 VIP 用戶
 * const requireVip = createConditionalGuard(
 *   (store) => store.getters['user/isVip'],
 *   '/upgrade'
 * )
 */
export function createConditionalGuard(condition, redirectTo) {
  return (to, from, next) => {
    if (condition(store, to)) {
      next()
    } else if (typeof redirectTo === 'string') {
      next(redirectTo)
    } else {
      next(redirectTo)
    }
  }
}

/**
 * 管理員權限守衛
 * 若用戶不是管理員，重導向到首頁
 *
 * @param {Object} to - 目標路由物件
 * @param {Object} from - 來源路由物件
 * @param {Function} next - 導航控制函數
 */
export function requireAdmin(to, from, next) {
  const isLoggedIn = store.getters['user/isLoggedIn']
  const isAdmin = store.state.user?.currentUser?.isAdmin ?? false

  if (isLoggedIn && isAdmin) {
    next()
  } else if (!isLoggedIn) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  } else {
    // 已登入但不是管理員
    next('/')
  }
}

/**
 * 會話驗證守衛
 * 檢查用戶會話是否仍然有效
 *
 * @param {Object} to - 目標路由物件
 * @param {Object} from - 來源路由物件
 * @param {Function} next - 導航控制函數
 */
export function validateSession(to, from, next) {
  const isSessionValid = store.getters['user/isSessionValid']
  const isLoggedIn = store.getters['user/isLoggedIn']

  if (!isLoggedIn) {
    // 未登入，允許導航（由其他守衛處理）
    next()
  } else if (isSessionValid) {
    // 會話有效，允許導航
    next()
  } else {
    // 會話過期，執行登出並重導向到登入頁面
    store.dispatch('user/logout').then(() => {
      next({
        path: '/login',
        query: {
          redirect: to.fullPath,
          sessionExpired: 'true'
        }
      })
    })
  }
}

/**
 * 組合多個守衛
 * 依序執行多個守衛，任一守衛阻止導航則停止
 *
 * @param {...Function} guards - 要組合的守衛函數
 * @returns {Function} - 組合後的路由守衛函數
 *
 * @example
 * // 組合多個守衛
 * {
 *   path: '/admin/settings',
 *   component: AdminSettings,
 *   beforeEnter: combineGuards(validateSession, requireAuth, requireAdmin)
 * }
 */
export function combineGuards(...guards) {
  return async (to, from, next) => {
    // 建立一個執行鏈
    const runGuard = async (index) => {
      if (index >= guards.length) {
        // 所有守衛都通過
        return next()
      }

      const guard = guards[index]

      // 建立一個 Promise 來等待守衛完成
      await new Promise((resolve) => {
        guard(to, from, (destination) => {
          if (destination === undefined || destination === true) {
            // 守衛允許導航，繼續下一個
            resolve(runGuard(index + 1))
          } else {
            // 守衛阻止導航或重導向
            next(destination)
            resolve()
          }
        })
      })
    }

    await runGuard(0)
  }
}

/**
 * 載入中狀態守衛
 * 等待用戶初始化完成後再進行導航檢查
 *
 * @param {Function} guardFn - 要延遲執行的守衛函數
 * @returns {Function} - 包裝後的路由守衛函數
 *
 * @example
 * {
 *   path: '/profile',
 *   component: Profile,
 *   beforeEnter: waitForInit(requireAuth)
 * }
 */
export function waitForInit(guardFn) {
  return async (to, from, next) => {
    // 等待用戶系統初始化完成
    const maxWait = 5000 // 最多等待 5 秒
    const startTime = Date.now()

    const waitForLoading = () => {
      return new Promise((resolve) => {
        const checkLoading = () => {
          const isLoading = store.state.user?.isLoading ?? false

          if (!isLoading) {
            resolve()
          } else if (Date.now() - startTime > maxWait) {
            // 超時，繼續執行
            console.warn('[Router Guard] User initialization timeout')
            resolve()
          } else {
            setTimeout(checkLoading, 50)
          }
        }
        checkLoading()
      })
    }

    await waitForLoading()

    // 執行原始守衛
    guardFn(to, from, next)
  }
}

/**
 * 權限檢查守衛工廠
 * 根據權限列表檢查用戶是否有權限
 *
 * @param {string|string[]} permissions - 需要的權限
 * @param {Object} options - 選項
 * @param {boolean} options.requireAll - 是否需要所有權限（預設 false，只需任一）
 * @param {string} options.redirectTo - 無權限時的重導向路徑
 * @returns {Function} - 路由守衛函數
 */
export function requirePermission(permissions, options = {}) {
  const { requireAll = false, redirectTo = '/' } = options
  const permList = Array.isArray(permissions) ? permissions : [permissions]

  return (to, from, next) => {
    const userPermissions = store.state.user?.currentUser?.permissions ?? []

    const hasPermission = requireAll
      ? permList.every(p => userPermissions.includes(p))
      : permList.some(p => userPermissions.includes(p))

    if (hasPermission) {
      next()
    } else {
      next(redirectTo)
    }
  }
}

// 預設匯出所有守衛
export default {
  requireAuth,
  redirectIfAuthenticated,
  createConditionalGuard,
  requireAdmin,
  validateSession,
  combineGuards,
  waitForInit,
  requirePermission
}
