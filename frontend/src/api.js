// 统一 API 封装。开发期 /api 由 Vite 代理到 Flask:5000。
// 后端统一响应:{ code, message, data }。code!==0 视为业务错误。

const TOKEN_KEY = 'poker_access_token'
const REFRESH_KEY = 'poker_refresh_token'

// Token 过期 / 未授权的后端错误码(errors.py)
const AUTH_EXPIRED_CODES = new Set([40101, 40102])

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}
export function setRefreshToken(t) {
  if (t) localStorage.setItem(REFRESH_KEY, t)
  else localStorage.removeItem(REFRESH_KEY)
}
// 登录/重置成功后统一存双 Token
export function setTokens(d) {
  setToken(d?.access_token)
  setRefreshToken(d?.refresh_token)
}
export function clearAuth() {
  setToken(null)
  setRefreshToken(null)
}

async function parseJson(res) {
  // 兜住 Nginx/网关返回的非 JSON(502/504 HTML 页)导致的解析崩溃
  try {
    return await res.json()
  } catch {
    throw new Error(`服务暂时不可用(${res.status})`)
  }
}

// 用 Refresh Token 换新 Access Token;并发只发一次刷新请求
let refreshing = null
async function tryRefresh() {
  const rt = getRefreshToken()
  if (!rt) return null
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST', headers: { Authorization: `Bearer ${rt}` },
        })
        const j = await res.json().catch(() => ({}))
        if (j.code === 0 && j.data?.access_token) {
          setToken(j.data.access_token)
          return j.data.access_token
        }
      } catch { /* 网络异常,按刷新失败处理 */ }
      return null
    })()
  }
  const t = await refreshing
  refreshing = null
  return t
}

async function doFetch(path, { method = 'GET', body, auth = false }, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return parseJson(res)
}

async function request(path, opts = {}) {
  const { auth = false } = opts
  let json = await doFetch(path, opts, auth ? getToken() : null)
  // Access Token 过期 → 自动刷新一次并重试;刷新失败则清掉登录态
  if (auth && AUTH_EXPIRED_CODES.has(json.code)) {
    const newAccess = await tryRefresh()
    if (newAccess) {
      json = await doFetch(path, opts, newAccess)
    } else {
      clearAuth()
    }
  }
  if (json.code !== 0) {
    const err = new Error(json.message || '请求失败')
    err.code = json.code
    throw err
  }
  return json.data
}

async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const headers = {}
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  const res = await fetch('/api/admin/upload', { method: 'POST', headers, body: fd })
  const json = await parseJson(res)
  if (json.code !== 0) throw new Error(json.message || '上传失败')
  return json.data.url
}

// 登录用户上传个人头像(校友用户会同步到其校友牌)
async function uploadAvatar(file) {
  const fd = new FormData()
  fd.append('file', file)
  const headers = {}
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  const res = await fetch('/api/user/avatar', { method: 'POST', headers, body: fd })
  const json = await parseJson(res)
  if (json.code !== 0) throw new Error(json.message || '上传失败')
  return json.data // { avatar_url, synced_to_card }
}

export const api = {
  uploadFile,
  uploadAvatar,
  listCards: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v),
    ).toString()
    return request(`/cards${qs ? `?${qs}` : ''}`)
  },
  // auth 可选:带 token 时后端额外返回联系方式(登录后可见)
  getCard: (key) => request(`/cards/${encodeURIComponent(key)}`, { auth: true }),
  listSpecial: () => request('/special-cards', { auth: true }),
  sendCode: (phone, purpose = 'login') =>
    request('/auth/send-code', { method: 'POST', body: { phone, purpose } }),
  login: (phone, code) =>
    request('/auth/login', { method: 'POST', body: { phone, code } }),
  loginPassword: (phone, password) =>
    request('/auth/login-password', { method: 'POST', body: { phone, password } }),
  setPassword: (new_password, old_password) =>
    request('/auth/set-password', {
      method: 'POST', body: { new_password, old_password }, auth: true,
    }),
  resetPassword: (phone, code, new_password) =>
    request('/auth/reset-password', {
      method: 'POST', body: { phone, code, new_password },
    }),
  profile: () => request('/user/profile', { auth: true }),
  leaderboard: (game) =>
    request(`/leaderboard${game ? `?game=${game}` : ''}`),

  // ---- 游戏插件 ----
  games: () => request('/games'),
  gameInfo: (gameId) => request(`/games/${gameId}/info`),
  gameCheck: (gameId) =>
    request(`/games/${gameId}/check`, { method: 'POST', auth: true }),
  gamePlay: (gameId) =>
    request(`/games/${gameId}/play`, { method: 'POST', auth: true }),
  gameScore: (gameId, payload) =>
    request(`/games/${gameId}/score`, { method: 'POST', body: payload, auth: true }),

  // ---- 管理后台 ----
  adminStats: () => request('/admin/stats', { auth: true }),
  adminUsers: (q = '', page = 1) =>
    request(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&size=20`, { auth: true }),
  adminSetPoints: (id, payload) =>
    request(`/admin/users/${id}/points`, { method: 'POST', body: payload, auth: true }),
  adminLinkCard: (id, card_key) =>
    request(`/admin/users/${id}/link-card`, { method: 'POST', body: { card_key }, auth: true }),
  adminCards: (q = '', page = 1) =>
    request(`/admin/cards?q=${encodeURIComponent(q)}&page=${page}&size=20`, { auth: true }),
  adminEditCard: (id, payload) =>
    request(`/admin/cards/${id}`, { method: 'PUT', body: payload, auth: true }),
  adminSpecial: () => request('/admin/special-cards', { auth: true }),
  adminEditSpecial: (type, payload) =>
    request(`/admin/special-cards/${type}`, { method: 'PUT', body: payload, auth: true }),
  adminGames: () => request('/admin/games', { auth: true }),
  adminToggleGame: (gameId, enabled) =>
    request(`/admin/games/${gameId}/toggle`, {
      method: 'POST', body: { enabled }, auth: true,
    }),
  adminGetSettings: () => request('/admin/settings', { auth: true }),
  adminPutSettings: (payload) =>
    request('/admin/settings', { method: 'PUT', body: payload, auth: true }),
  settings: () => request('/settings'),
}
