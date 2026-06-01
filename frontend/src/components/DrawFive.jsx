import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { drawWeightedHand, GOOD_HAND_RANK, HANDS } from '../utils/pokerHand'

const SUIT_SYMBOL = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' }
const SUIT_COLOR = {
  hearts: 'text-hearts', diamonds: 'text-diamonds',
  spades: 'text-spades', clubs: 'text-clubs',
}

const LS_COUNT = 'poker_draw_count'
const LS_BEST = 'poker_best_hand'
const LS_DRY = 'poker_draw_dry'
const PITY_THRESHOLD = 4 // 连续 4 次没好牌 → 本次保底 ≥同花

function loadBest() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_BEST) || 'null')
    return v && typeof v.rank === 'number' ? v : null
  } catch {
    return null
  }
}

// 单张手牌:受控翻面。背面=校徽蓝;正面=校友牌面(可点进详情)
function HandCard({ card, flipped, index, onPick }) {
  const sym = SUIT_SYMBOL[card.suit] || '?'
  const color = SUIT_COLOR[card.suit] || 'text-school'
  const name = card.alumni_name?.replace(/【.*?】/, '')
  const company = card.company_name?.replace(/【.*?】/, '')

  if (!flipped) {
    return (
      <div
        style={{ animationDelay: `${index * 80}ms` }}
        className="animate-cardIn aspect-[5/7] rounded-xl bg-gradient-to-br from-school to-school-dark
                   ring-1 ring-white/20 shadow-card flex items-center justify-center"
      >
        <span className="text-white/15 text-2xl">♠</span>
      </div>
    )
  }
  return (
    <button
      onClick={() => onPick(card)}
      style={{ animationDelay: `${index * 150}ms` }}
      className="card-reveal aspect-[5/7] rounded-xl bg-white shadow-card overflow-hidden
                 relative flex flex-col items-center justify-center px-1 active:scale-95 transition"
    >
      <span className={`absolute top-1 left-1.5 leading-none font-extrabold text-[11px] ${color}`}>
        {card.rank}
        <span className="block text-[9px]">{sym}</span>
      </span>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-school-mid to-school
                      flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow-inner">
        {name?.[0] || sym}
      </div>
      <p className="mt-1 w-full text-center text-[10px] font-semibold text-school-deep truncate leading-tight">
        {name}
      </p>
      {company && (
        <p className="w-full text-center text-[8px] text-slate-400 truncate leading-tight">{company}</p>
      )}
    </button>
  )
}

export default function DrawFive({ cards, onClose }) {
  const navigate = useNavigate()
  // idle | dealing | flipping | revealed
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [count, setCount] = useState(() => Number(localStorage.getItem(LS_COUNT) || 0))
  const [best, setBest] = useState(loadBest)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function deal() {
    timers.current.forEach(clearTimeout)
    timers.current = []

    const dry = Number(localStorage.getItem(LS_DRY) || 0)
    const minRank = dry >= PITY_THRESHOLD ? GOOD_HAND_RANK : 0
    const r = drawWeightedHand(cards, { minRank })
    if (!r) return

    setResult(r)
    setPhase('dealing')

    // 发牌(背面)→ 翻牌 → 出牌型
    timers.current.push(setTimeout(() => setPhase('flipping'), 650))
    timers.current.push(setTimeout(() => {
      setPhase('revealed')
      // 统计落库
      const newCount = Number(localStorage.getItem(LS_COUNT) || 0) + 1
      localStorage.setItem(LS_COUNT, String(newCount))
      setCount(newCount)

      const good = r.hand.rank >= GOOD_HAND_RANK
      localStorage.setItem(LS_DRY, String(good ? 0 : dry + 1))

      const prevBest = loadBest()
      if (!prevBest || r.hand.rank > prevBest.rank) {
        const b = { rank: r.hand.rank, name: r.hand.name }
        localStorage.setItem(LS_BEST, JSON.stringify(b))
        setBest(b)
      }
    }, 650 + 5 * 150 + 250))
  }

  function pickCard(card) {
    onClose()
    navigate(`/card/${card.card_key}`)
  }

  const isGood = result && result.hand.rank >= GOOD_HAND_RANK
  const flipped = phase === 'flipping' || phase === 'revealed'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-school-deep/95 backdrop-blur-sm animate-pageIn">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-xs text-white/60">已抽 {count} 次 · 最佳 {best?.name || '—'}</span>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 text-white text-lg leading-none">×</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-white tracking-wide">抽王牌 · 试手气</h2>
          <p className="text-xs text-white/55 mt-1">从 52 位创业校友中抽五张,看看你的牌型</p>
        </div>

        {phase === 'idle' ? (
          // 牌堆
          <div className="relative w-28 h-40 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{ transform: `translate(${i * 3}px, ${i * 3}px)` }}
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-school to-school-dark
                           ring-1 ring-white/20 shadow-cardHover flex items-center justify-center"
              >
                {i === 3 && <span className="text-gold text-4xl">♠</span>}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 牌型横幅 */}
            <div className="h-12 mb-4 flex items-center justify-center">
              {phase === 'revealed' && (
                <div
                  className={`px-6 py-2 rounded-full font-extrabold text-lg animate-cardIn
                    ${isGood
                      ? 'bg-gradient-to-r from-gold to-gold-dark text-white gold-glow'
                      : 'bg-white/10 text-white'}`}
                >
                  {isGood && '🎉 '}{result.hand.name}
                </div>
              )}
            </div>

            {/* 五张牌 */}
            <div className="grid grid-cols-5 gap-1.5 w-full mb-8">
              {result.cards.map((c, i) => (
                <HandCard key={c.card_key} card={c} index={i} flipped={flipped} onPick={pickCard} />
              ))}
            </div>

            {phase === 'revealed' && (
              <p className="text-[11px] text-white/45 -mt-4 mb-6">点牌面 → 查看校友档案</p>
            )}
          </>
        )}

        <button
          onClick={deal}
          disabled={phase === 'dealing' || phase === 'flipping'}
          className="px-10 py-3 rounded-full bg-gold text-school-deep font-extrabold text-base
                     shadow-cardHover active:scale-95 transition disabled:opacity-50"
        >
          {phase === 'idle' ? '抽五张' : phase === 'revealed' ? '再抽一次' : '发牌中…'}
        </button>
      </div>
    </div>
  )
}
