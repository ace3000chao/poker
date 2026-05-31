import { useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from '../api'

/* 图片上传 + 预览(正面/背面通用) */
function ImageUpload({ label, value, onChange, hint }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true); setErr('')
    try {
      const url = await api.uploadFile(f)
      onChange(url)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="mb-3">
      <label className="text-xs text-slate-400">{label}</label>
      <div className="flex items-center gap-3 mt-1">
        <div className="w-16 h-[88px] rounded-lg bg-school-light overflow-hidden flex items-center justify-center shrink-0">
          {value
            ? <img src={value} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px] text-slate-400">无图</span>}
        </div>
        <div className="flex-1 min-w-0">
          <label className="inline-block px-3 py-1.5 rounded-lg bg-school text-white text-xs cursor-pointer">
            {busy ? '上传中…' : '选择图片'}
            <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
          </label>
          {value && (
            <button type="button" onClick={() => onChange('')}
              className="ml-2 text-xs text-schoolred underline">移除</button>
          )}
          {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
          {err && <p className="text-[10px] text-schoolred mt-1">{err}</p>}
        </div>
      </div>
    </div>
  )
}

/* ---------------- 登录 ---------------- */
function AdminLogin({ onOk }) {
  const [phone, setPhone] = useState('')
  const [pwd, setPwd] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    try {
      const d = await api.loginPassword(phone, pwd)
      if (d.user?.role !== 'admin') {
        setMsg('该账号无管理员权限')
        return
      }
      setToken(d.access_token)
      onOk()
    } catch (e) {
      setMsg(e.message)
    }
  }
  return (
    <div className="min-h-full flex items-center justify-center bg-school-tint p-6">
      <form onSubmit={submit} className="w-full max-w-xs bg-white rounded-3xl shadow-card overflow-hidden">
        <div className="bg-gradient-to-r from-school to-school-dark px-6 py-4">
          <img src="/logo-zspt-white.png" alt="logo" className="h-8 object-contain" />
        </div>
        <div className="p-6">
          <h1 className="text-lg font-extrabold text-school-deep">管理后台</h1>
          <p className="text-xs text-slate-400 mb-5">管理员手机号 + 密码登录</p>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="管理员手机号"
            className="w-full mb-3 px-4 py-2.5 rounded-xl bg-school-light text-sm outline-none focus:ring-2 focus:ring-school" />
          <input value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" placeholder="密码"
            className="w-full mb-4 px-4 py-2.5 rounded-xl bg-school-light text-sm outline-none focus:ring-2 focus:ring-school" />
          <button className="w-full py-2.5 rounded-xl bg-school text-white font-semibold hover:bg-school-dark transition">
            登录
          </button>
          {msg && <p className="mt-3 text-xs text-schoolred">{msg}</p>}
        </div>
      </form>
    </div>
  )
}

/* ---------------- 概览 ---------------- */
function Stats() {
  const [s, setS] = useState(null)
  useEffect(() => { api.adminStats().then(setS).catch(() => {}) }, [])
  if (!s) return <p className="text-slate-400 p-4">加载中…</p>
  const items = [
    ['注册用户', s.users], ['管理员', s.admins],
    ['扑克牌', s.cards], ['已公开', s.cards_published],
    ['特殊牌', s.special_cards], ['游戏', s.games],
    ['已上架游戏', s.games_enabled], ['对局总数', s.game_plays],
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
      {items.map(([k, v]) => (
        <div key={k} className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-2xl font-extrabold text-school">{v}</div>
          <div className="text-xs text-slate-500 mt-1">{k}</div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- 用户 ---------------- */
function Users() {
  const [q, setQ] = useState('')
  const [data, setData] = useState({ items: [], total: 0 })
  const load = useCallback((kw) => api.adminUsers(kw).then(setData).catch(() => {}), [])
  useEffect(() => { load('') }, [load])

  async function adjust(u) {
    const v = window.prompt(`设置 ${u.phone} 的积分(当前 ${u.points}):`, u.points)
    if (v == null) return
    try {
      await api.adminSetPoints(u.id, { set: parseInt(v, 10) })
      load(q)
    } catch (e) { alert(e.message) }
  }
  return (
    <div className="p-4">
      <form onSubmit={(e) => { e.preventDefault(); load(q) }} className="flex gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索手机号/昵称"
          className="flex-1 px-3 py-2 rounded-lg bg-white shadow-card text-sm outline-none" />
        <button className="px-4 rounded-lg bg-school text-white text-sm">搜索</button>
      </form>
      <div className="bg-white rounded-2xl shadow-card overflow-hidden text-sm">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 bg-school-light text-school-dark font-semibold text-xs">
          <span>手机号 / 角色</span><span>积分</span><span>操作</span>
        </div>
        {data.items.map((u) => (
          <div key={u.id} className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 border-t border-school/10 items-center">
            <span>{u.phone}
              {u.role === 'admin' && <em className="ml-2 not-italic text-[10px] px-1.5 py-0.5 rounded bg-schoolred text-white">管理员</em>}
            </span>
            <span className="text-school font-semibold">{u.points}</span>
            <button onClick={() => adjust(u)} className="text-school text-xs underline">调积分</button>
          </div>
        ))}
        {data.items.length === 0 && <p className="p-4 text-slate-400 text-xs">无数据</p>}
      </div>
      <p className="text-xs text-slate-400 mt-2">共 {data.total} 人</p>
    </div>
  )
}

/* ---------------- 扑克牌 ---------------- */
function Cards() {
  const [q, setQ] = useState('')
  const [data, setData] = useState({ items: [], total: 0 })
  const [edit, setEdit] = useState(null)
  const load = useCallback((kw) => api.adminCards(kw).then(setData).catch(() => {}), [])
  useEffect(() => { load('') }, [load])

  async function save() {
    try {
      await api.adminEditCard(edit.id, {
        alumni_name: edit.alumni_name, company_name: edit.company_name,
        position: edit.position, industry: edit.industry,
        suit: edit.suit, rank: edit.rank, is_published: edit.is_published,
        card_image_url: edit.card_image_url || '',
      })
      setEdit(null); load(q)
    } catch (e) { alert(e.message) }
  }
  return (
    <div className="p-4">
      <form onSubmit={(e) => { e.preventDefault(); load(q) }} className="flex gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索 牌号/姓名/公司"
          className="flex-1 px-3 py-2 rounded-lg bg-white shadow-card text-sm outline-none" />
        <button className="px-4 rounded-lg bg-school text-white text-sm">搜索</button>
      </form>
      <div className="bg-white rounded-2xl shadow-card overflow-hidden text-sm">
        {data.items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-school/10">
            <span className="w-20 shrink-0 text-school font-mono text-xs">{c.card_key}</span>
            <span className="flex-1 min-w-0 truncate">{c.alumni_name} · {c.company_name}</span>
            {!c.is_published && <em className="not-italic text-[10px] text-slate-400">未公开</em>}
            <button onClick={() => setEdit({ ...c })} className="text-school text-xs underline shrink-0">编辑</button>
          </div>
        ))}
        {data.items.length === 0 && <p className="p-4 text-slate-400 text-xs">无数据</p>}
      </div>
      <p className="text-xs text-slate-400 mt-2">共 {data.total} 张</p>

      {edit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-school-deep mb-3">编辑 {edit.card_key}</h3>
            {[
              ['alumni_name', '姓名'], ['company_name', '公司'],
              ['position', '职位'], ['industry', '行业'],
              ['suit', '花色(spades/hearts/clubs/diamonds)'], ['rank', '点数(A-K)'],
            ].map(([f, label]) => (
              <input key={f} value={edit[f] || ''} placeholder={label}
                onChange={(e) => setEdit({ ...edit, [f]: e.target.value })}
                className="w-full mb-2 px-3 py-2 rounded-lg bg-school-light text-sm outline-none" />
            ))}
            <ImageUpload
              label="扑克牌正面图(该牌专属)"
              value={edit.card_image_url}
              onChange={(url) => setEdit({ ...edit, card_image_url: url })}
              hint="美工绘制的该张牌正面图,各牌不同"
            />
            <label className="flex items-center gap-2 text-sm my-2">
              <input type="checkbox" checked={!!edit.is_published}
                onChange={(e) => setEdit({ ...edit, is_published: e.target.checked })} />
              公开展示
            </label>
            <div className="flex gap-2 mt-3">
              <button onClick={save} className="flex-1 py-2 rounded-lg bg-school text-white text-sm font-semibold">保存</button>
              <button onClick={() => setEdit(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- 大小王 ---------------- */
function Special() {
  const [items, setItems] = useState([])
  const reload = () => api.adminSpecial().then((d) => setItems(d.items || [])).catch(() => {})
  useEffect(() => { reload() }, [])

  async function save(s) {
    try {
      await api.adminEditSpecial(s.type, {
        title: s.title, subtitle: s.subtitle, motto: s.motto,
        description: s.description, contact_phone: s.contact_phone,
        contact_email: s.contact_email, address: s.address,
        website_url: s.website_url, card_image_url: s.card_image_url || '',
      })
      alert('已保存'); reload()
    } catch (e) { alert(e.message) }
  }
  return (
    <div className="p-4 space-y-4">
      {items.map((s, idx) => (
        <div key={s.type} className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-school-deep mb-3">
            {s.subtitle}（{s.type === 'king' ? '大王=学校' : '小王=学院'}）
          </h3>
          {[
            ['title', '名称'], ['motto', '校训/院训'], ['description', '简介'],
            ['contact_phone', '电话'], ['contact_email', '邮箱'],
            ['address', '地址'], ['website_url', '官网'],
          ].map(([f, label]) => (
            <div key={f} className="mb-2">
              <label className="text-xs text-slate-400">{label}</label>
              <input value={s[f] || ''}
                onChange={(e) => {
                  const n = [...items]; n[idx] = { ...s, [f]: e.target.value }; setItems(n)
                }}
                className="w-full px-3 py-2 rounded-lg bg-school-light text-sm outline-none" />
            </div>
          ))}
          <ImageUpload
            label={`${s.subtitle}正面图`}
            value={s.card_image_url}
            onChange={(url) => {
              const n = [...items]; n[idx] = { ...s, card_image_url: url }; setItems(n)
            }}
            hint="美工绘制的大王/小王正面图"
          />
          <button onClick={() => save(items[idx])}
            className="mt-2 px-5 py-2 rounded-lg bg-school text-white text-sm font-semibold">保存</button>
        </div>
      ))}
    </div>
  )
}

/* ---------------- 游戏 ---------------- */
function Games() {
  const [items, setItems] = useState([])
  const reload = () => api.adminGames().then((d) => setItems(d.items || [])).catch(() => {})
  useEffect(() => { reload() }, [])
  async function toggle(g) {
    try { await api.adminToggleGame(g.game_id, !g.is_enabled); reload() }
    catch (e) { alert(e.message) }
  }
  return (
    <div className="p-4 space-y-3">
      {items.map((g) => (
        <div key={g.game_id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-school-deep">{g.name} <span className="text-xs text-slate-400">v{g.version}</span></p>
            <p className="text-xs text-slate-500 truncate">{g.description}</p>
          </div>
          <button onClick={() => toggle(g)}
            className={`px-4 py-2 rounded-full text-xs font-semibold ${g.is_enabled
              ? 'bg-school text-white' : 'bg-slate-200 text-slate-500'}`}>
            {g.is_enabled ? '已上架' : '已下架'}
          </button>
        </div>
      ))}
      {items.length === 0 && <p className="text-slate-400 text-xs">暂无游戏</p>}
    </div>
  )
}

/* ---------------- 统一背面图 ---------------- */
function CardBack() {
  const [url, setUrl] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    api.adminGetSettings().then((d) => setUrl(d.card_back_url || '')).catch(() => {})
  }, [])
  async function save() {
    try { await api.adminPutSettings({ card_back_url: url }); setSaved(true) }
    catch (e) { alert(e.message) }
  }
  return (
    <div className="p-4">
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-school-deep mb-1">扑克牌统一背面图</h3>
        <p className="text-xs text-slate-400 mb-4">
          全部 54 张牌共用同一张背面;尚未上传正面图的牌,前端将以此背面展示。
        </p>
        <ImageUpload
          label="统一背面图"
          value={url}
          onChange={(u) => { setUrl(u); setSaved(false) }}
          hint="建议竖版扑克牌比例(约 5:7)"
        />
        <button onClick={save}
          className="mt-2 px-5 py-2 rounded-lg bg-school text-white text-sm font-semibold">
          保存
        </button>
        {saved && <span className="ml-3 text-xs text-school">已保存</span>}
      </div>
    </div>
  )
}

/* ---------------- 主框架 ---------------- */
const TABS = [
  ['stats', '概览', Stats], ['users', '用户', Users],
  ['cards', '扑克牌', Cards], ['special', '大小王', Special],
  ['cardback', '牌背', CardBack], ['games', '游戏', Games],
]

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState('stats')

  useEffect(() => {
    if (!getToken()) { setChecking(false); return }
    api.adminStats().then(() => setAuthed(true)).catch(() => {}).finally(() => setChecking(false))
  }, [])

  if (checking) return <p className="p-10 text-center text-slate-400">…</p>
  if (!authed) return <AdminLogin onOk={() => setAuthed(true)} />

  const Active = TABS.find((t) => t[0] === tab)[2]
  return (
    <div className="min-h-full bg-school-tint flex flex-col">
      <header className="bg-school text-white px-4 py-3 flex items-center gap-3">
        <img src="/logo-zspt-white.png" alt="logo" className="h-6 object-contain" />
        <span className="text-sm font-bold border-l border-white/30 pl-3">管理后台</span>
        <button onClick={() => { setToken(null); setAuthed(false) }}
          className="ml-auto text-xs bg-white/15 px-3 py-1 rounded-full">退出</button>
      </header>
      <nav className="bg-white flex overflow-x-auto border-b border-school/10 text-sm">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-3 whitespace-nowrap ${tab === k
              ? 'text-school font-semibold border-b-2 border-school' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </nav>
      <main className="flex-1 max-w-screen-md mx-auto w-full"><Active /></main>
    </div>
  )
}
