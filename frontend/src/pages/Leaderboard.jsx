import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const MEDAL_EMOJI = ['🥇', '🥈', '🥉']
const BAR_COLOR   = ['bg-yellow-400', 'bg-gray-400', 'bg-amber-600']

function buildRows(items) {
  const rows = []
  for (let i = 0; i < 3; i++) {
    if (items[i]) {
      rows.push({ ...items[i], placeholder: false })
    } else {
      rows.push({ rank: i + 1, nickname: '虚位以待', points: null, placeholder: true })
    }
  }
  for (let i = 3; i < items.length; i++) {
    rows.push({ ...items[i], placeholder: false })
  }
  return rows
}

export default function Leaderboard() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.leaderboard()
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const rows = buildRows(items)

  return (
    <div className="min-h-screen bg-school-tint">
      <header className="bg-school text-white px-4 py-2.5 sticky top-0 z-10 shadow-card flex items-center justify-between">
        <button
          onClick={() => navigate('/games')}
          className="flex items-center gap-1 text-sm hover:opacity-80"
        >
          <span className="text-base leading-none">&#8249;</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">排行榜</span>
        <span className="opacity-0 px-3">占位</span>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-school border-t-transparent" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            {rows.map((item, idx) => {
              const isMedal = idx < 3
              const isPlaceholder = item.placeholder
              return (
                <div
                  key={isPlaceholder ? `placeholder-${idx}` : item.user_id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 ${isPlaceholder ? 'opacity-50' : ''}`}
                >
                  <span className={`w-1 h-8 rounded-full ${isMedal ? BAR_COLOR[idx] : 'bg-school/20'}`} />
                  {isMedal ? (
                    <span className="text-lg">{MEDAL_EMOJI[idx]}</span>
                  ) : (
                    <span className="text-sm font-medium text-slate-500 w-5 text-center">
                      {item.rank}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isPlaceholder ? 'text-slate-300 italic' : 'text-school-deep'}`}>
                      {item.nickname}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {isPlaceholder ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <>
                        <span className="font-bold text-school">
                          {item.points.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400 ml-0.5">分</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
