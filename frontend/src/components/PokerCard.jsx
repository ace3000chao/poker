import { Link } from 'react-router-dom'

const SUIT_SYMBOL = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' }
const SUIT_COLOR = {
  hearts: 'text-hearts',
  spades: 'text-spades',
  clubs: 'text-clubs',
  diamonds: 'text-diamonds',
}

// 仿真扑克牌:四角点数花色 + 中心头像 + 底部校友信息。
export default function PokerCard({ card, index = 0 }) {
  const sym = SUIT_SYMBOL[card.suit] || '?'
  const color = SUIT_COLOR[card.suit] || 'text-tiffany-deep'

  return (
    <Link
      to={`/card/${card.card_key}`}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      className="group animate-cardIn relative aspect-[5/7] rounded-2xl bg-white
                 border border-tiffany/40 shadow-card hover:shadow-cardHover
                 hover:-translate-y-1.5 transition-all duration-200
                 overflow-hidden flex flex-col"
    >
      {/* 顶部彩条 */}
      <div className="h-1.5 w-full bg-gradient-to-r from-tiffany to-tiffany-dark" />

      {/* 左上角 点数+花色 */}
      <div className={`absolute top-3 left-2.5 leading-none ${color}`}>
        <div className="text-base font-extrabold">{card.rank}</div>
        <div className="text-sm">{sym}</div>
      </div>
      {/* 右下角 镜像 */}
      <div className={`absolute bottom-2 right-2.5 leading-none rotate-180 ${color}`}>
        <div className="text-base font-extrabold">{card.rank}</div>
        <div className="text-sm">{sym}</div>
      </div>

      {/* 中心头像 */}
      <div className="flex-1 flex flex-col items-center justify-center px-2">
        <div
          className="w-14 h-14 rounded-full bg-gradient-to-br from-tiffany-light to-tiffany
                     flex items-center justify-center text-tiffany-deep text-2xl
                     font-bold shadow-inner ring-2 ring-white"
        >
          {card.alumni_name?.replace(/【.*?】/, '')[0] || sym}
        </div>
        <p className="mt-2 text-[13px] font-semibold text-tiffany-deep text-center leading-tight line-clamp-2">
          {card.alumni_name?.replace(/【占位】/, '')}
        </p>
      </div>

      {/* 底部信息 */}
      <div className="px-2.5 pb-2.5 text-center">
        <p className="text-[11px] text-slate-500 truncate">{card.company_name}</p>
        <span
          className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full
                     bg-tiffany/15 text-tiffany-deep"
        >
          {card.industry}
        </span>
      </div>
    </Link>
  )
}
