import { Link } from 'react-router-dom'

// 王牌(大王=学校 / 小王=学院)。
// 有美工正面图 → 整张展示;无图 → 紧凑信息条(不占大块)。
export default function SpecialCard({ card }) {
  const isKing = card.type === 'king'
  const art = card.card_image_url

  if (art) {
    return (
      <Link
        to={`/special/${card.type}`}
        className="group relative block aspect-[5/7] rounded-2xl overflow-hidden
                   ring-2 ring-[#E8B33A]/70 shadow-cardHover
                   hover:-translate-y-1 transition-all duration-200"
      >
        <img src={art} alt={card.title} className="w-full h-full object-cover" />
        <span className="absolute top-2 left-2 text-[10px] tracking-widest
                         text-white bg-black/30 px-2 py-0.5 rounded-full">
          {card.subtitle}
        </span>
      </Link>
    )
  }

  return (
    <Link
      to={`/special/${card.type}`}
      className="group relative flex items-center gap-3 rounded-xl overflow-hidden
                 px-3 py-3 text-white ring-1 ring-[#E8B33A]/60 shadow-card
                 bg-gradient-to-br from-school-deep via-school to-school-dark
                 hover:-translate-y-0.5 transition-all duration-200"
    >
      <span className="pointer-events-none absolute -right-3 -bottom-3 text-[64px]
                       leading-none text-[#E8B33A]/10 select-none">♛</span>
      <div className="shrink-0 w-12 h-12 rounded-full bg-white/10 ring-1 ring-[#E8B33A]/50
                      flex items-center justify-center overflow-hidden">
        {isKing ? (
          <img src="/logo-zspt-white.png" alt={card.title} className="w-9 h-9 object-contain" />
        ) : (
          <span className="text-xl font-bold">{card.title?.[0]}</span>
        )}
      </div>
      <div className="min-w-0 flex-1 relative">
        <span className="inline-block text-[10px] tracking-[0.2em] text-[#E8B33A] font-semibold">
          {card.subtitle}
        </span>
        <p className="text-sm font-bold leading-tight truncate">{card.title}</p>
      </div>
      <span className="relative text-[#E8B33A] text-lg shrink-0">♛</span>
    </Link>
  )
}
