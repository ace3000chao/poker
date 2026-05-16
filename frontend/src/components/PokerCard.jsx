import { Link } from 'react-router-dom'

const SUIT_SYMBOL = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' }
const SUIT_COLOR = {
  hearts: 'text-hearts',
  spades: 'text-spades',
  clubs: 'text-clubs',
  diamonds: 'text-diamonds',
}

// 仿真扑克牌:四角点数花色 + 中心头像 + 底部校友信息。
// min-w-0 防止底部长文字撑破 grid 列(grid item 默认 min-width:auto)。
export default function PokerCard({ card, index = 0 }) {
  const sym = SUIT_SYMBOL[card.suit] || '?'
  const color = SUIT_COLOR[card.suit] || 'text-tiffany-deep'
  const name = card.alumni_name?.replace(/【.*?】/, '')

  return (
    <Link
      to={`/card/${card.card_key}`}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      className="group animate-cardIn relative min-w-0 aspect-[3/4] rounded-2xl
                 bg-white border border-tiffany/30 shadow-card hover:shadow-cardHover
                 hover:-translate-y-1 transition-all duration-200
                 overflow-hidden flex flex-col"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-tiffany to-tiffany-dark shrink-0" />

      {/* 四角点数+花色 */}
      <div className={`absolute top-2.5 left-2.5 leading-none ${color}`}>
        <div className="text-sm font-extrabold">{card.rank}</div>
        <div className="text-xs">{sym}</div>
      </div>
      <div className={`absolute bottom-2.5 right-2.5 leading-none rotate-180 ${color}`}>
        <div className="text-sm font-extrabold">{card.rank}</div>
        <div className="text-xs">{sym}</div>
      </div>

      {/* 主体:头像 + 姓名 + 公司 + 行业,纵向均匀分布填满 */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1.5 px-3 py-2">
        <div
          className="w-12 h-12 rounded-full bg-gradient-to-br from-tiffany-light to-tiffany
                     flex items-center justify-center text-tiffany-deep text-xl font-bold
                     ring-2 ring-white shadow-inner shrink-0"
        >
          {name?.[0] || sym}
        </div>
        <p className="w-full text-center text-[13px] font-semibold text-tiffany-deep truncate">
          {name}
        </p>
        <p className="w-full text-center text-[11px] text-slate-500 truncate">
          {card.company_name?.replace(/【.*?】/, '')}
        </p>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-tiffany/15 text-tiffany-deep shrink-0">
          {card.industry}
        </span>
      </div>
    </Link>
  )
}
