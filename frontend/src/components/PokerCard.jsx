import { Link } from 'react-router-dom'

const SUIT_SYMBOL = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' }
const SUIT_COLOR = {
  hearts: 'text-hearts',
  spades: 'text-spades',
  clubs: 'text-clubs',
  diamonds: 'text-diamonds',
}

// 展示优先级:美工正面图 > 统一背面图(占位) > 自动生成版式。
export default function PokerCard({ card, index = 0, cardBack }) {
  const sym = SUIT_SYMBOL[card.suit] || '?'
  const color = SUIT_COLOR[card.suit] || 'text-school'
  const name = card.alumni_name?.replace(/【.*?】/, '')
  const art = card.card_image_url
  const delay = { animationDelay: `${Math.min(index, 12) * 30}ms` }

  const base =
    'group animate-cardIn relative min-w-0 aspect-[5/7] rounded-2xl ' +
    'shadow-card hover:shadow-cardHover hover:-translate-y-1 ' +
    'transition-all duration-200 overflow-hidden block'

  // 1) 有专属正面图
  if (art) {
    return (
      <Link to={`/card/${card.card_key}`} style={delay} className={base}>
        <img src={art} alt={name} className="w-full h-full object-cover" />
      </Link>
    )
  }
  // 2) 无正面图 → 统一背面图占位
  if (cardBack) {
    return (
      <Link to={`/card/${card.card_key}`} style={delay}
        className={`${base} bg-school`}>
        <img src={cardBack} alt="牌背" className="w-full h-full object-cover" />
      </Link>
    )
  }
  // 3) 兜底:自动生成版式
  return (
    <Link to={`/card/${card.card_key}`} style={delay}
      className={`${base} bg-white border border-school/15 flex flex-col`}>
      <div className="h-1.5 w-full bg-gradient-to-r from-school to-school-mid shrink-0" />
      <div className={`absolute top-2.5 left-2.5 leading-none ${color}`}>
        <div className="text-sm font-extrabold">{card.rank}</div>
        <div className="text-xs">{sym}</div>
      </div>
      <div className={`absolute bottom-2.5 right-2.5 leading-none rotate-180 ${color}`}>
        <div className="text-sm font-extrabold">{card.rank}</div>
        <div className="text-xs">{sym}</div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1.5 px-3 py-2">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-school-mid to-school flex items-center justify-center text-white text-xl font-bold ring-2 ring-white shadow-inner shrink-0">
          {name?.[0] || sym}
        </div>
        <p className="w-full text-center text-[13px] font-semibold text-school-deep truncate">
          {name}
        </p>
        <p className="w-full text-center text-[11px] text-slate-500 truncate">
          {card.company_name?.replace(/【.*?】/, '')}
        </p>
      </div>
    </Link>
  )
}
