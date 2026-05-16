import { useEffect, useState } from 'react'
import { api } from '../api'
import PokerCard from '../components/PokerCard'

const SUITS = [
  { key: 'hearts', symbol: '♥', label: '科技 · 互联网 · AI', color: 'text-hearts', bar: 'bg-hearts' },
  { key: 'spades', symbol: '♠', label: '电商 · 贸易 · 金融', color: 'text-spades', bar: 'bg-spades' },
  { key: 'clubs', symbol: '♣', label: '餐饮 · 服务 · 零售', color: 'text-clubs', bar: 'bg-clubs' },
  { key: 'diamonds', symbol: '♦', label: '制造 · 实体 · 农业', color: 'text-diamonds', bar: 'bg-diamonds' },
]

export default function CardWall() {
  const [cards, setCards] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load(keyword) {
    setLoading(true)
    api
      .listCards({ q: keyword })
      .then((d) => {
        setCards(d.items)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
  }, [])

  const grouped = SUITS.map((s) => ({
    ...s,
    items: cards.filter((c) => c.suit === s.key),
  }))

  return (
    <div className="overflow-x-hidden">
      {/* Hero(搜索条作为 hero 内部最后一块,避免负边距层叠遮挡) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-tiffany via-tiffany to-tiffany-dark px-5 pt-8 pb-6">
        <div className="pointer-events-none absolute -right-10 -top-10 text-[150px] leading-none opacity-10 select-none z-0">♠</div>
        <div className="pointer-events-none absolute -right-4 bottom-2 text-[80px] leading-none opacity-10 select-none z-0">♦</div>

        <div className="relative z-10 max-w-screen-md mx-auto">
          <h1 className="text-2xl font-extrabold text-tiffany-deep">我们的王牌</h1>
          <p className="mt-1 text-sm text-tiffany-deep/80">
            中山职业技术学院 20 周年 · 52 位创业校友珍藏扑克
          </p>
          <div className="mt-4 flex gap-5 text-tiffany-deep">
            <div>
              <div className="text-xl font-bold">{cards.length || 52}</div>
              <div className="text-[11px] opacity-75">校友牌</div>
            </div>
            <div className="border-l border-tiffany-deep/20 pl-5">
              <div className="text-xl font-bold">4</div>
              <div className="text-[11px] opacity-75">行业花色</div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              load(q)
            }}
            className="mt-5 flex gap-2 bg-white rounded-full shadow-card p-1.5"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索校友姓名 / 公司 / 创业项目"
              className="flex-1 min-w-0 px-4 py-2 rounded-full text-sm bg-transparent
                         outline-none placeholder:text-slate-400 text-tiffany-deep"
            />
            <button
              className="shrink-0 px-5 py-2 rounded-full text-sm font-semibold
                         bg-tiffany text-tiffany-deep hover:bg-tiffany-dark transition"
            >
              搜索
            </button>
          </form>
        </div>
      </section>

      {/* 牌墙 */}
      <div className="max-w-screen-md mx-auto px-4 mt-6">
        {loading && (
          <p className="text-center text-tiffany-dark py-12 animate-pulse">
            正在翻开扑克牌…
          </p>
        )}
        {error && <p className="text-center text-hearts py-12">{error}</p>}

        {!loading &&
          !error &&
          grouped.map((g) => (
            <section key={g.key} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-6 rounded-full ${g.bar}`} />
                <span className={`text-xl font-bold ${g.color}`}>{g.symbol}</span>
                <h2 className="font-bold text-tiffany-deep">{g.label}</h2>
                <span className="ml-auto text-xs text-slate-400">
                  {g.items.length} 张
                </span>
              </div>
              {g.items.length === 0 ? (
                <p className="text-xs text-slate-400 pl-4">无匹配结果</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {g.items.map((c, i) => (
                    <PokerCard key={c.card_key} card={c} index={i} />
                  ))}
                </div>
              )}
            </section>
          ))}
      </div>
    </div>
  )
}
