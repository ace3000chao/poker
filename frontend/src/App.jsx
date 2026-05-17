import { Routes, Route, Link, useLocation } from 'react-router-dom'
import CardWall from './pages/CardWall'
import CardDetail from './pages/CardDetail'
import SpecialDetail from './pages/SpecialDetail'
import Login from './pages/Login'
import { getToken } from './api'

export default function App() {
  const loc = useLocation()
  const logged = !!getToken()
  const onHome = loc.pathname === '/'

  return (
    <div className="min-h-full flex flex-col bg-school-tint">
      {/* 首页 hero 自带品牌头,内页才显示蓝底顶栏 */}
      {!onHome && (
        <header className="bg-school text-white px-4 py-2.5 sticky top-0 z-10 shadow-card">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo-zspt-white.png"
              alt="中山职业技术学院"
              className="h-7 w-auto object-contain"
            />
            <span className="text-sm font-bold border-l border-white/30 pl-3">
              我们的王牌
            </span>
          </Link>
        </header>
      )}

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<CardWall />} />
          <Route path="/card/:key" element={<CardDetail />} />
          <Route path="/special/:type" element={<SpecialDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<CardWall />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-school/15 flex text-xs text-center shadow-[0_-4px_16px_-8px_rgba(0,58,102,0.18)]">
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
                active ? 'text-school font-semibold' : 'text-slate-400'
              }`}
            >
              <div className={`text-base ${active ? 'text-school' : ''}`}>{t.icon}</div>
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
