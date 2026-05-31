import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken } from '../api'

// 登录态下设置 / 修改密码。首次设置可将「原密码」留空。
export default function ChangePassword() {
  const nav = useNavigate()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState('')

  if (!getToken()) {
    nav('/login')
    return null
  }

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    try {
      await api.setPassword(newPassword, oldPassword)
      setMsg('密码已保存')
      setTimeout(() => nav('/'), 800)
    } catch (e) {
      setMsg(e.message)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-school-light text-sm outline-none focus:ring-2 focus:ring-school'

  return (
    <div className="max-w-xs mx-auto p-6 mt-8">
      <div className="rounded-3xl bg-white shadow-card p-6">
        <h1 className="text-lg font-extrabold text-school-deep">设置 / 修改密码</h1>
        <p className="text-xs text-slate-400 mb-5">首次设置可将「原密码」留空</p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="原密码(首次设置留空)"
            className={inputCls}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新密码(≥8 位,含字母和数字)"
            className={inputCls}
          />
          <button className="w-full py-2.5 rounded-xl bg-school text-white font-semibold hover:bg-school-dark transition">
            保存
          </button>
        </form>

        <button
          onClick={() => nav('/')}
          className="mt-3 w-full text-xs text-school-dark underline"
        >
          返回首页
        </button>

        {msg && <p className="mt-3 text-xs text-slate-500">{msg}</p>}
      </div>
    </div>
  )
}
