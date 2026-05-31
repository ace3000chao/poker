import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearAuth } from '../api'

const ROLE_BADGE = {
  admin: { label: '管理员', cls: 'bg-schoolred/15 text-schoolred-dark' },
  alumni: { label: '校友扑克用户', cls: 'bg-gold/20 text-gold-dark' },
  user: { label: '普通用户', cls: 'bg-school-light text-school-dark' },
}

function maskPhone(p) {
  return p ? p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''
}

export default function Profile() {
  const nav = useNavigate()
  const fileRef = useRef(null)
  const [p, setP] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!getToken()) { nav('/login'); return }
    api.profile().then(setP).catch((e) => setMsg(e.message))
  }, [nav])

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    setMsg('')
    try {
      const d = await api.uploadAvatar(f)
      setP((prev) => ({ ...prev, avatar_url: d.avatar_url }))
      setMsg(d.synced_to_card ? '头像已更新,并同步到你的校友牌' : '头像已更新')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function logout() {
    clearAuth()
    nav('/')
  }

  if (!p) {
    return <p className="p-8 text-center text-school animate-pulse">加载中…</p>
  }

  const badge = ROLE_BADGE[p.role] || ROLE_BADGE.user
  const name = p.nickname || `用户${p.id}`

  return (
    <div className="max-w-sm mx-auto p-4 animate-pageIn">
      <div className="rounded-3xl bg-white shadow-card overflow-hidden">
        {/* 头部:渐变 + 头像 */}
        <div className="relative bg-gradient-to-br from-school via-school to-school-dark px-6 pt-7 pb-12">
          <span className="pointer-events-none absolute -right-6 -top-6 text-[110px] leading-none text-white/5">♠</span>
          <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        <div className="px-6 pb-6 -mt-10">
          <div className="relative w-20 h-20">
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-card bg-school-light"
              />
            ) : (
              <div className="w-20 h-20 rounded-full ring-4 ring-white shadow-card
                              bg-gradient-to-br from-school-mid to-school
                              flex items-center justify-center text-3xl font-bold text-white">
                {name[0]}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-school text-white
                         text-sm shadow-card ring-2 ring-white disabled:opacity-50"
              title="上传头像"
            >
              {busy ? '…' : '✎'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="hidden"
            />
          </div>

          <h1 className="mt-3 text-xl font-extrabold text-school-deep">{name}</h1>
          <p className="text-sm text-slate-400">{maskPhone(p.phone)}</p>

          <div className="mt-4 flex items-center gap-4">
            <div>
              <div className="text-xl font-bold text-school">{p.points ?? 0}</div>
              <div className="text-[11px] text-slate-400">我的积分</div>
            </div>
            {p.is_alumni && p.alumni_card && (
              <Link
                to={`/card/${p.alumni_card.card_key}`}
                className="ml-auto px-4 py-2 rounded-full text-sm font-semibold
                           bg-gold/15 text-gold-dark active:scale-95 transition"
              >
                🂡 我的校友牌 ›
              </Link>
            )}
          </div>

          {msg && <p className="mt-3 text-xs text-school-dark">{msg}</p>}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => nav('/change-password')}
              className="py-2.5 rounded-xl bg-school-light text-school-dark text-sm font-semibold"
            >
              修改密码
            </button>
            <button
              onClick={logout}
              className="py-2.5 rounded-xl bg-white border border-schoolred/30 text-schoolred text-sm font-semibold"
            >
              退出登录
            </button>
          </div>

          {p.role === 'admin' && (
            <button
              onClick={() => nav('/admin')}
              className="mt-3 w-full py-2.5 rounded-xl bg-school text-white text-sm font-semibold"
            >
              ⚙ 进入管理后台
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
