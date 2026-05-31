import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import PokerCard from '../components/PokerCard'
import SpecialCard from '../components/SpecialCard'
import DrawFive from '../components/DrawFive'
import { shuffle } from '../utils/pokerHand'

// 展示顺序:黑桃 → 红桃 → 梅花 → 方块(花色分组,不按行业)
const SUITS = [
  { key: 'spades', symbol: '♠', name: '黑桃', color: 'text-spades', bar: 'bg-spades' },
  { key: 'hearts', symbol: '♥', name: '红桃', color: 'text-hearts', bar: 'bg-hearts' },
  { key: 'clubs', symbol: '♣', name: '梅花', color: 'text-clubs', bar: 'bg-clubs' },
  { key: 'diamonds', symbol: '♦', name: '方块', color: 'text-diamonds', bar: 'bg-diamonds' },
]

const MODES = [
  { key: 'suit', label: '花色' },
  { key: 'random', label: '随机' },
  { key: 'year', label: '按届' },
]

export default function CardWall() {
  const [cards, setCards] = useState([])
  const [allCards, setAllCards] = useState([]) // 完整 52 张,供抽牌用(不受搜索影响)
  const [special, setSpecial] = useState([])
  const [cardBack, setCardBack] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('suit')
  const [shuffleSeed, setShuffleSeed] = useState(0)
  const [drawOpen, setDrawOpen] = useState(false)

  function load(keyword) {
    setLoading(true)
    api
      .listCards({ q: keyword })
      .then((d) => {
        setCards(d.items || [])
        if (!keyword) setAllCards(d.items || []) // 无搜索词时即完整牌组
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

  // 大王在前,小王在后(合法二元比较器)
  const sortedSpecial = [...special].sort(
    (a, b) => (a.type === 'king' ? 0 : 1) - (b.type === 'king' ? 0 : 1),
  )

  const grouped = SUITS.map((s) => ({
    ...s,
    items: cards.filter((c) => c.suit === s.key),
  }))

  // 随机模式:洗一次牌(shuffleSeed 变化即重洗)
  const shuffled = useMemo(() => shuffle(cards), [cards, shuffleSeed])

  // 按届:按毕业年份分组,有年份的在前(新→旧),未知的垫后
  const byYear = useMemo(() => {
    const m = new Map()
    for (const c of cards) {
      const y = c.graduation_year || 0
      if (!m.has(y)) m.set(y, [])
      m.get(y).push(c)
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0])
  }, [cards])

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

          {/* 抽王牌 CTA */}
          <button
            onClick={() => setDrawOpen(true)}
            className="mt-3 w-full py-2.5 rounded-full font-extrabold text-school-deep
                       bg-gradient-to-r from-gold to-gold-dark shadow-cardHover
                       active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            🎴 抽一手好牌 · 试手气
          </button>
        </div>
      </section>

      {/* 牌墙 */}
      <div className="max-w-screen-md mx-auto px-4 mt-6">
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[5/7] rounded-2xl" />
            ))}
          </div>
        )}
        {error && <p className="text-center text-schoolred py-12">{error}</p>}

        {/* 王牌(仅花色模式 + 非搜索时展示) */}
        {!loading && !error && mode === 'suit' && sortedSpecial.length > 0 && !q && (
          <section className="mb-9">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-6 rounded-full bg-gold" />
              <span className="text-xl font-bold text-gold">♛</span>
              <h2 className="font-bold text-school-deep">王牌 · 学校与学院</h2>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              {sortedSpecial.map((s) => (
                <SpecialCard key={s.type} card={s} />
              ))}
            </div>
          </section>
        )}

        {/* 排序 / 洗牌控件 */}
        {!loading && !error && cards.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex bg-school-light rounded-full p-0.5">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    mode === m.key ? 'bg-school text-white shadow-sm' : 'text-school-dark'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === 'random' && (
              <button
                onClick={() => setShuffleSeed((s) => s + 1)}
                className="ml-auto px-3.5 py-1.5 rounded-full text-xs font-semibold
                           bg-gold/15 text-gold-dark active:scale-95 transition"
              >
                🔀 洗牌
              </button>
            )}
          </div>
        )}

        {/* 花色分组 */}
        {!loading && !error && mode === 'suit' &&
          grouped.map((g) => (
            <section key={g.key} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-6 rounded-full ${g.bar}`} />
                <span className={`text-xl font-bold ${g.color}`}>{g.symbol}</span>
                <h2 className="font-bold text-school-deep">{g.name}</h2>
                <span className="ml-auto text-xs text-slate-400">{g.items.length} 张</span>
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

        {/* 随机 */}
        {!loading && !error && mode === 'random' && (
          <div
            key={shuffleSeed}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5"
          >
            {shuffled.map((c, i) => (
              <PokerCard key={c.card_key} card={c} index={i} cardBack={cardBack} />
            ))}
          </div>
        )}

        {/* 按届 */}
        {!loading && !error && mode === 'year' &&
          byYear.map(([year, items]) => (
            <section key={year} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-6 rounded-full bg-school" />
                <h2 className="font-bold text-school-deep">
                  {year ? `${year} 届` : '年份待补'}
                </h2>
                <span className="ml-auto text-xs text-slate-400">{items.length} 张</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {items.map((c, i) => (
                  <PokerCard key={c.card_key} card={c} index={i} cardBack={cardBack} />
                ))}
              </div>
            </section>
          ))}
      </div>

      {drawOpen && (allCards.length >= 5 || cards.length >= 5) && (
        <DrawFive
          cards={allCards.length >= 5 ? allCards : cards}
          onClose={() => setDrawOpen(false)}
        />
      )}
    </div>
  )
}
