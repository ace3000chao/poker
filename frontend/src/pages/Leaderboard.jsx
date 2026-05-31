import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const MEDAL = ['🥇', '🥈', '🥉']
// 领奖台:亚军在左、冠军居中(更高)、季军在右
const PODIUM_ORDER = [1, 0, 2]
const PODIUM_RING = ['ring-slate-300', 'ring-gold', 'ring-amber-600']
const PODIUM_H = ['h-16', 'h-24', 'h-12']

function fill(items, i) {
  return items[i] || { rank: i + 1, nickname: '虚位以待', points: null, placeholder: true }
}

export default function Leaderboard() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.leaderboard()
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const top3 = [0, 1, 2].map((i) => fill(items, i))
  const rest = items.slice(3)

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

      <div className="max-w-lg mx-auto animate-pageIn">
        {/* 金色荣誉头 + 领奖台 */}
        <section className="relative overflow-hidden bg-gradient-to-br from-school-deep via-school to-school-dark px-4 pt-6 pb-7">
          <div className="pointer-events-none absolute -right-6 -top-6 text-[120px] leading-none text-gold/10 select-none">🏆</div>
          <h1 className="relative text-center text-lg font-extrabold text-white tracking-wide">
            积分排行榜
          </h1>
          <p className="relative text-center text-[11px] text-white/60 mt-0.5 mb-5">
            玩游戏赢积分,登顶王牌之巅
          </p>

          {loading ? (
            <div className="flex justify-center gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton w-20 h-28 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="relative flex items-end justify-center gap-2.5">
              {PODIUM_ORDER.map((rankIdx) => {
                const p = top3[rankIdx]
                return (
                  <div key={rankIdx} className="flex flex-col items-center w-1/4">
                    <span className="text-2xl">{MEDAL[rankIdx]}</span>
                    <div className={`mt-1 w-12 h-12 rounded-full bg-white/10 ring-2 ${PODIUM_RING[rankIdx]}
                                     flex items-center justify-center text-white font-bold overflow-hidden`}>
                      {p.placeholder ? '·' : (p.nickname?.[0] || '?')}
                    </div>
                    <p className={`mt-1.5 text-xs font-semibold text-center truncate w-full px-0.5
                                   ${p.placeholder ? 'text-white/30 italic' : 'text-white'}`}>
                      {p.nickname}
                    </p>
                    <p className="text-[11px] text-gold font-bold">
                      {p.placeholder ? '—' : `${p.points.toLocaleString()}`}
                    </p>
                    <div className={`mt-1.5 w-full ${PODIUM_H[rankIdx]} rounded-t-xl
                                     bg-gradient-to-b from-gold/80 to-gold/30
                                     flex items-start justify-center pt-1`}>
                      <span className="text-white/90 font-extrabold text-sm">{rankIdx + 1}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 第 4 名及以后 */}
        <div className="px-4 py-5">
          {loading ? (
            <div className="bg-white rounded-2xl shadow-card divide-y divide-slate-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="skeleton w-5 h-5 rounded-full" />
                  <div className="skeleton h-3.5 flex-1 rounded-full" />
                  <div className="skeleton h-3.5 w-12 rounded-full" />
                </div>
              ))}
            </div>
          ) : rest.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">
              {items.length === 0 ? '还没有人上榜,快去玩一局抢占榜单!' : '更多名次虚位以待'}
            </p>
          ) : (
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              {rest.map((item) => (
                <div
                  key={item.user_id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0"
                >
                  <span className="w-6 text-center text-sm font-semibold text-slate-400">
                    {item.rank}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-school-light flex items-center justify-center
                                  text-xs font-bold text-school shrink-0">
                    {item.nickname?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0 font-medium text-school-deep truncate">
                    {item.nickname}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-school">{item.points.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 ml-0.5">分</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
