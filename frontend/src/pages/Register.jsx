import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, setTokens } from '../api'

export default function Register() {
  const nav = useNavigate()
  const [f, setF] = useState({ phone: '', password: '', real_name: '', grade: '', major: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function set(k, v) { setF((p) => ({ ...p, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const d = await api.register(f)
      setTokens(d)
      // 校友手机号自动通过;否则待审核
      if (d.user?.status === 'approved') {
        setMsg('注册成功!已识别为校友,直接通过')
      } else {
        setMsg('注册成功!资料已提交,等待管理员审核通过')
      }
      setTimeout(() => nav('/me'), 900)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-school-light text-sm outline-none focus:ring-2 focus:ring-school'

  return (
    <div className="max-w-xs mx-auto p-6 mt-8 animate-pageIn">
      <div className="rounded-3xl bg-white shadow-card p-6">
        <div className="-mx-6 -mt-6 mb-5 px-6 py-4 bg-gradient-to-r from-school to-school-dark rounded-t-3xl">
          <img src="/logo-zspt-white.png" alt="中山职业技术学院" className="h-8 w-auto object-contain" />
        </div>

        <h1 className="text-lg font-extrabold text-school-deep">注册账号</h1>
        <p className="text-xs text-slate-400 mb-5">填写真实信息供校友身份核验,提交后待管理员审核</p>

        <form onSubmit={submit} className="space-y-3">
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)}
            placeholder="手机号" inputMode="numeric" className={inputCls} />
          <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)}
            placeholder="设置密码(≥8 位,含字母和数字)" className={inputCls} />
          <input value={f.real_name} onChange={(e) => set('real_name', e.target.value)}
            placeholder="真实姓名" className={inputCls} />
          <input value={f.grade} onChange={(e) => set('grade', e.target.value)}
            placeholder="年级(如 2015 级)" className={inputCls} />
          <input value={f.major} onChange={(e) => set('major', e.target.value)}
            placeholder="专业" className={inputCls} />

          <button disabled={busy}
            className="w-full py-2.5 rounded-xl bg-school text-white font-semibold hover:bg-school-dark transition disabled:opacity-50">
            {busy ? '提交中…' : '注册'}
          </button>
        </form>

        {msg && <p className="mt-3 text-xs text-school-dark">{msg}</p>}

        <Link to="/login" className="mt-4 block text-center text-xs text-school-dark underline">
          已有账号 · 去登录
        </Link>
      </div>
    </div>
  )
}
