import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setTokens, getToken } from '../api'

// 三种模式:验证码登录(新号自动注册) / 密码登录 / 忘记密码重置。
// 验证码当前为后端桩实现,开发期看后端日志。
export default function Login() {
  const nav = useNavigate()
  const [mode, setMode] = useState('code') // code | password | reset
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [cd, setCd] = useState(0)
  const [msg, setMsg] = useState('')

  const logged = !!getToken()

  async function send() {
    setMsg('')
    try {
      await api.sendCode(phone, mode === 'reset' ? 'reset_password' : 'login')
      setMsg('验证码已发送(开发期看后端日志)')
      setCd(60)
      const t = setInterval(
        () => setCd((c) => (c <= 1 ? (clearInterval(t), 0) : c - 1)),
        1000,
      )
    } catch (e) {
      setMsg(e.message)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    try {
      let d
      if (mode === 'code') d = await api.login(phone, code)
      else if (mode === 'password') d = await api.loginPassword(phone, password)
      else d = await api.resetPassword(phone, code, newPassword)
      setTokens(d)
      nav('/')
    } catch (e) {
      setMsg(e.message)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-school-light text-sm outline-none focus:ring-2 focus:ring-school'

  const tab = (key, label) => (
    <button
      type="button"
      onClick={() => { setMode(key); setMsg('') }}
      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
        mode === key
          ? 'bg-school text-white shadow-sm'
          : 'bg-school-light text-school-dark'
      }`}
    >
      {label}
    </button>
  )

  const title =
    mode === 'code' ? '登录 / 注册' : mode === 'password' ? '密码登录' : '忘记密码'
  const subtitle =
    mode === 'code'
      ? '手机号 + 验证码,新号自动注册'
      : mode === 'password'
        ? '手机号 + 密码'
        : '验证码重置密码'
  const submitLabel =
    mode === 'code' ? '登录' : mode === 'password' ? '登录' : '重置并登录'

  return (
    <div className="max-w-xs mx-auto p-6 mt-8 animate-pageIn">
      <div className="rounded-3xl bg-white shadow-card p-6">
        <div className="-mx-6 -mt-6 mb-5 px-6 py-4 bg-gradient-to-r from-school to-school-dark rounded-t-3xl">
          <img
            src="/logo-zspt-white.png"
            alt="中山职业技术学院"
            className="h-8 w-auto object-contain"
          />
        </div>

        <div className="flex gap-2 mb-4">
          {tab('code', '验证码登录')}
          {tab('password', '密码登录')}
          {tab('reset', '忘记密码')}
        </div>

        <h1 className="text-lg font-extrabold text-school-deep">{title}</h1>
        <p className="text-xs text-slate-400 mb-5">{subtitle}</p>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="手机号"
            inputMode="numeric"
            className={inputCls}
          />

          {mode === 'password' && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              className={inputCls}
            />
          )}

          {(mode === 'code' || mode === 'reset') && (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="验证码"
                inputMode="numeric"
                className="flex-1 px-4 py-2.5 rounded-xl bg-school-light text-sm outline-none focus:ring-2 focus:ring-school"
              />
              <button
                type="button"
                disabled={cd > 0 || phone.length !== 11}
                onClick={send}
                className="px-4 py-2.5 text-sm rounded-xl font-medium bg-school-light text-school-dark disabled:opacity-40"
              >
                {cd > 0 ? `${cd}s` : '获取'}
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码(≥8 位,含字母和数字)"
              className={inputCls}
            />
          )}

          <button className="w-full py-2.5 rounded-xl bg-school text-white font-semibold hover:bg-school-dark transition">
            {submitLabel}
          </button>
        </form>

        {logged && (
          <button
            onClick={() => nav('/change-password')}
            className="mt-3 w-full text-xs text-school-dark underline"
          >
            已登录 · 去设置 / 修改密码
          </button>
        )}

        {msg && <p className="mt-3 text-xs text-slate-500">{msg}</p>}
      </div>
    </div>
  )
}
