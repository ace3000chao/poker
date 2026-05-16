import { useEffect, useState } from 'react'

// 移动端优先布局基线 + 后端连通性自检(调用 /api/health)。
// 档案展示 / 游戏 / 后台等页面后续在此基础上扩展路由。
export default function App() {
  const [health, setHealth] = useState({ state: 'loading' })

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth({ state: 'ok', data: d }))
      .catch((e) => setHealth({ state: 'error', error: String(e) }))
  }, [])

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white px-4 py-3 shadow">
        <h1 className="text-lg font-bold">我们的王牌</h1>
        <p className="text-xs text-slate-300">扑克游戏平台 · 开发骨架</p>
      </header>

      <main className="flex-1 p-4 max-w-screen-sm mx-auto w-full">
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">后端连通性自检</h2>
          {health.state === 'loading' && (
            <p className="text-slate-500 text-sm">检测中…</p>
          )}
          {health.state === 'ok' && (
            <pre className="text-xs bg-slate-100 rounded p-2 overflow-x-auto">
              {JSON.stringify(health.data, null, 2)}
            </pre>
          )}
          {health.state === 'error' && (
            <p className="text-hearts text-sm">
              无法连接后端:{health.error}(确认 Flask 已在 5000 端口运行)
            </p>
          )}
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {['扑克牌墙', '游戏中心', '排行榜', '我的'].map((t) => (
            <div
              key={t}
              className="bg-white rounded-xl shadow p-6 text-center text-slate-400"
            >
              {t}
              <div className="text-xs mt-1">(待开发)</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
