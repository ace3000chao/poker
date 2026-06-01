import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken } from '../api'

// 校友可自助编辑的公开字段(与后端白名单一致)
const FIELDS = [
  { k: 'company_name', label: '公司名称' },
  { k: 'position', label: '职位' },
  { k: 'industry', label: '行业' },
  { k: 'business_desc', label: '一句话业务范围', textarea: true },
  { k: 'alumni_quote', label: '座右铭 / 感言', textarea: true },
  { k: 'major', label: '专业' },
  { k: 'college', label: '学院' },
  { k: 'graduation_year', label: '毕业年份', type: 'number' },
  { k: 'founded_year', label: '公司创立年份', type: 'number' },
  { k: 'team_size', label: '团队规模' },
  { k: 'contact_phone', label: '联系电话' },
  { k: 'wechat', label: '微信' },
  { k: 'email', label: '邮箱' },
  { k: 'company_address', label: '公司地址' },
  { k: 'latest_news', label: '最新动态', textarea: true },
]

export default function EditCard() {
  const nav = useNavigate()
  const [form, setForm] = useState(null)
  const [cardKey, setCardKey] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!getToken()) { nav('/login'); return }
    api.profile().then((p) => {
      if (!p.is_alumni || !p.alumni_card) { nav('/me'); return }
      setCardKey(p.alumni_card.card_key)
      setName(p.alumni_card.alumni_name)
      return api.getCard(p.alumni_card.card_key).then((c) => {
        const f = {}
        for (const { k } of FIELDS) f[k] = c[k] ?? ''
        setForm(f)
      })
    }).catch((e) => setMsg(e.message))
  }, [nav])

  function set(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      await api.updateMyCard(form)
      setMsg('已保存,公开资料已更新')
      setTimeout(() => nav(`/card/${cardKey}`), 700)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl bg-school-light text-sm outline-none focus:ring-2 focus:ring-school'

  if (!form) {
    return <p className="p-8 text-center text-school animate-pulse">加载中…</p>
  }

  return (
    <div className="max-w-sm mx-auto p-4 animate-pageIn">
      <div className="rounded-3xl bg-white shadow-card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-school to-school-dark">
          <h1 className="text-base font-extrabold text-white">编辑我的校友资料</h1>
          <p className="text-[11px] text-white/60 mt-0.5">{name} · 仅你本人可改;姓名/牌面由学校维护</p>
        </div>

        <form onSubmit={save} className="p-5 space-y-3">
          {FIELDS.map(({ k, label, textarea, type }) => (
            <label key={k} className="block">
              <span className="block text-xs text-slate-400 mb-1">{label}</span>
              {textarea ? (
                <textarea
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                  rows={2}
                  className={inputCls + ' resize-none'}
                />
              ) : (
                <input
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                  type={type || 'text'}
                  inputMode={type === 'number' ? 'numeric' : undefined}
                  className={inputCls}
                />
              )}
            </label>
          ))}

          {msg && <p className="text-xs text-school-dark">{msg}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => nav('/me')}
              className="flex-1 py-2.5 rounded-xl bg-school-light text-school-dark text-sm font-semibold"
            >
              返回
            </button>
            <button
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-school text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
