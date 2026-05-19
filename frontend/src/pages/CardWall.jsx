import { useEffect, useState } from 'react'
import { api } from '../api'
import PokerCard from '../components/PokerCard'
import SpecialCard from '../components/SpecialCard'

// 展示顺序:黑桃 → 红桃 → 梅花 → 方块(花色分组,不按行业)
const SUITS = [
  { key: 'spades', symbol: '♠', name: '黑桃', color: 'text-spades', bar: 'bg-spades' },
  { key: 'hearts', symbol: '♥', name: '红桃', color: 'text-hearts', bar: 'bg-hearts' },
  { key: 'clubs', symbol: '♣', name: '梅花', color: 'text-clubs', bar: 'bg-clubs' },
  { key: 'diamonds', symbol: '♦', name: '方块', color: 'text-diamonds', bar: 'bg-diamonds' },
]

export default function CardWall() {
  const [cards, setCards] = useState([])
  const [special, setSpecial] = useState([])
  const [cardBack, setCardBack] = useState('')
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
    api
      .listSpecial()
      .then((d) => setSpecial(d.items || []))
      .catch(() => {})
    api
      .settings()
      .then((d) => setCardBack(d.card_back_url || ''))
      .catch(() => {})
  }, [])

  // 大王在前,小王在后
  const sortedSpecial = [...special].sort((a) =>
    a.type === 'king' ? -1 : 1,
  )

  const grouped = SUITS.map((s) => ({
    ...s,
    items: cards.filter((c) => c.suit === s.key),
  }))

  return (
    <div className="overflow-x-hidden">
      {/* Hero:校徽蓝渐变 + 学校白色 logo */}
      <section className="relative overflow-hidden bg-gradient-to-br from-school via-school to-school-dark px-5 pt-7 pb-7">
        <div className="pointer-events-none absolute -right-12 -top-12 text-[160px] leading-none text-white/5 select-none z-0">♠</div>
        <div className="pointer-events-none absolute right-6 bottom-0 text-[90px] leading-none text-white/5 select-none z-0">♥</div>

        <div className="relative z-10 max-w-screen-md mx-auto">
          <img
            src="/logo-zspt-white.png"
            alt="中山职业技术学院"
            className="h-9 w-auto object-contain ml-auto block"
          />
          <h1 className="mt-4 text-2xl font-extrabold text-white tracking-wide">
            我们的王牌
          </h1>
          <p className="mt-1 text-sm text-white/80">
            建校 20 周年 · 52 位创业校友珍藏扑克
          </p>
          <div className="mt-4 flex gap-5 text-white">
            <div>
              <div className="text-xl font-bold">{cards.length || 52}</div>
              <div className="text-[11px] text-white/70">校友牌</div>
            </div>
            <div className="border-l border-white/25 pl-5">
              <div className="text-xl font-bold">4</div>
              <div className="text-[11px] text-white/70">行业花色</div>
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
                         outline-none placeholder:text-slate-400 text-school-deep"
            />
            <button
              className="shrink-0 px-5 py-2 rounded-full text-sm font-semibold
                         bg-school text-white hover:bg-school-dark transition"
            >
              搜索
            </button>
          </form>
        </div>
      </section>

      {/* 牌墙 */}
      <div className="max-w-screen-md mx-auto px-4 mt-6">
        {loading && (
          <p className="text-center text-school py-12 animate-pulse">
            正在翻开扑克牌…
          </p>
        )}
        {error && <p className="text-center text-schoolred py-12">{error}</p>}

        {!loading && !error && sortedSpecial.length > 0 && !q && (
          <section className="mb-9">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-6 rounded-full bg-[#E8B33A]" />
              <span className="text-xl font-bold text-[#E8B33A]">♛</span>
              <h2 className="font-bold text-school-deep">王牌 · 学校与学院</h2>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              {sortedSpecial.map((s) => (
                <SpecialCard key={s.type} card={s} />
              ))}
            </div>
          </section>
        )}

        {!loading &&
          !error &&
          grouped.map((g) => (
            <section key={g.key} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-6 rounded-full ${g.bar}`} />
                <span className={`text-xl font-bold ${g.color}`}>{g.symbol}</span>
                <h2 className="font-bold text-school-deep">{g.name}</h2>
                <span className="ml-auto text-xs text-slate-400">
                  {g.items.length} 张
                </span>
              </div>
              {g.items.length === 0 ? (
                <p className="text-xs text-slate-400 pl-4">无匹配结果</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {g.items.map((c, i) => (
                    <PokerCard key={c.card_key} card={c} index={i} cardBack={cardBack} />
                  ))}
                </div>
              )}
            </section>
          ))}
      </div>
    </div>
  )
}
