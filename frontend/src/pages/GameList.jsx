import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { PUBLIC_GAME_IDS, PUBLIC_GAME_META } from '../config/gameRegistry'

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-school border-t-transparent" />
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
        <span className="text-3xl">🎮</span>
        <p className="text-sm">暂无可用游戏</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-school">选择游戏</h2>
        <button
          onClick={() => navigate('/leaderboard')}
          className="text-sm text-school/70 hover:text-school"
        >
          🏆 排行榜
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {games.map((g) => (
          <button
            key={g.game_id}
            onClick={() => navigate(PUBLIC_GAME_META[g.game_id]?.route || `/game/${g.game_id}`)}
            className="bg-white rounded-xl shadow-card p-5 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-14 h-14 rounded-xl bg-school-tint flex items-center justify-center text-2xl shrink-0">
              {PUBLIC_GAME_META[g.game_id]?.emoji || '🎮'}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-school text-base">{g.name}</div>
              {g.description && (
                <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{g.description}</div>
              )}
            </div>
            <div className="ml-auto text-slate-300 text-lg shrink-0">›</div>
          </button>
        ))}
      </div>
    </div>
  )
}
