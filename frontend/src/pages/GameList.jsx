import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { PUBLIC_GAME_IDS, PUBLIC_GAME_META } from '../config/gameRegistry'

// 图标底色:以校徽蓝为主,点缀红/金,保持 VI 一致又有层次
const TILE_GRADIENTS = [
  'from-school to-school-mid',
  'from-schoolred to-schoolred-dark',
  'from-gold to-gold-dark',
  'from-school-mid to-school-dark',
  'from-school-dark to-school-deep',
  'from-schoolred to-school',
  'from-gold-dark to-school',
]

export default function GameList() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.games()
      .then((data) => {
        const items = data.items || []
        const filtered = items.filter((game) => PUBLIC_GAME_IDS.includes(game.game_id))
        const sorted = [...filtered].sort(
          (a, b) => PUBLIC_GAME_IDS.indexOf(a.game_id) - PUBLIC_GAME_IDS.indexOf(b.game_id),
        )
        setGames(sorted)
      })
      .catch(() => setGames([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-pageIn">
      {/* 标题区 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-extrabold text-school-deep">王牌游戏厅</h1>
          <p className="text-xs text-slate-400 mt-0.5">玩一局,赢积分,冲榜单</p>
        </div>
        <button
          onClick={() => navigate('/leaderboard')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold
                     bg-gold/15 text-gold-dark active:scale-95 transition"
        >
          🏆 排行榜
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
              <div className="skeleton w-14 h-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-24 rounded-full" />
                <div className="skeleton h-2.5 w-40 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <span className="text-4xl">🎮</span>
          <p className="text-sm">暂无可用游戏</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {games.map((g, i) => (
            <button
              key={g.game_id}
              onClick={() => navigate(PUBLIC_GAME_META[g.game_id]?.route || `/game/${g.game_id}`)}
              style={{ animationDelay: `${i * 40}ms` }}
              className="animate-cardIn group bg-white rounded-2xl shadow-card hover:shadow-cardHover
                         p-4 flex items-center gap-4 text-left active:scale-[0.98]
                         transition-all duration-200"
            >
              <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center
                               text-2xl text-white shadow-inner bg-gradient-to-br
                               ${TILE_GRADIENTS[i % TILE_GRADIENTS.length]}`}>
                {PUBLIC_GAME_META[g.game_id]?.emoji || '🎮'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-school-deep text-base truncate">{g.name}</div>
                {g.description && (
                  <div className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {g.description}
                  </div>
                )}
              </div>
              <span className="shrink-0 flex items-center gap-0.5 px-3 py-1.5 rounded-full
                               text-xs font-semibold bg-school-light text-school
                               group-hover:bg-school group-hover:text-white transition-colors">
                开始 ›
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
