// 统一 API 封装。开发期 /api 由 Vite 代理到 Flask:5000。
// 后端统一响应:{ code, message, data }。code!==0 视为业务错误。

const TOKEN_KEY = 'poker_access_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
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
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message || '上传失败')
  return json.data.url
}

export const api = {
  uploadFile,
  listCards: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v),
    ).toString()
    return request(`/cards${qs ? `?${qs}` : ''}`)
  },
  getCard: (key) => request(`/cards/${encodeURIComponent(key)}`),
  listSpecial: () => request('/special-cards'),
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
  adminLogin: (phone, password) =>
    request('/auth/admin-login', { method: 'POST', body: { phone, password } }),
  adminStats: () => request('/admin/stats', { auth: true }),
  adminUsers: (q = '', page = 1) =>
    request(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&size=20`, { auth: true }),
  adminSetPoints: (id, payload) =>
    request(`/admin/users/${id}/points`, { method: 'POST', body: payload, auth: true }),
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
