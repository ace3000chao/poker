import { Routes, Route, Link, useLocation } from 'react-router-dom'
import CardWall from './pages/CardWall'
import CardDetail from './pages/CardDetail'
import Login from './pages/Login'
import { getToken } from './api'

export default function App() {
  const loc = useLocation()
  const logged = !!getToken()
  const onHome = loc.pathname === '/'

  return (
    <div className="min-h-full flex flex-col bg-[#F2FBF9]">
      {/* 首页 hero 自带标题,内页才显示顶栏 */}
      {!onHome && (
        <header className="bg-tiffany text-tiffany-deep px-4 py-3 sticky top-0 z-10 shadow-card">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg">♠</span>
            <div>
              <h1 className="text-base font-extrabold leading-none">我们的王牌</h1>
              <p className="text-[11px] opacity-75">创业校友扑克</p>
            </div>
          </Link>
        </header>
      )}

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<CardWall />} />
          <Route path="/card/:key" element={<CardDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<CardWall />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-tiffany/30 flex text-xs text-center shadow-[0_-4px_16px_-8px_rgba(14,77,69,0.2)]">
        {[
          { to: '/', label: '牌墙', icon: '♠' },
          { to: '/login', label: logged ? '我的' : '登录', icon: '◆' },
        ].map((t) => {
          const active = loc.pathname === t.to
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex-1 py-2.5 ${
                active ? 'text-tiffany-deep font-semibold' : 'text-slate-400'
              }`}
            >
              <div className={`text-base ${active ? 'text-tiffany-dark' : ''}`}>{t.icon}</div>
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
