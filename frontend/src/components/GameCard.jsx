import { backImage, faceImage } from '../config/cardAssets'

const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦' }
const SUIT_COLORS = { S: 'text-gray-900', H: 'text-red-600', C: 'text-gray-900', D: 'text-red-600' }
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const BACK_STYLE = {
  background: '#1e3a8a',
  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 8px)',
}

export default function GameCard() {
  return null
}

// 牌背
// 素材接入：public/assets/cards/back.png 就绪后，cardAssets.js 中设 enabled=true 即可
GameCard.Back = function Back({ className = '', style = {}, children }) {
  const imgUrl = backImage()

  if (imgUrl) {
    return (
      <div className={`w-full h-full rounded-[4px] overflow-hidden ${className}`} style={style}>
        <img src={imgUrl} alt="" className="w-full h-full object-cover rounded-[4px]" />
        {children}
      </div>
    )
  }

  return (
    <div
      className={`w-full h-full relative overflow-hidden rounded-[4px] ${className}`}
      style={{ ...BACK_STYLE, ...style }}
    >
      <div className="absolute inset-[3px] rounded-[2px] border border-white/10 pointer-events-none" />
      {children}
    </div>
  )
}

// 牌面
// 素材接入：public/assets/cards/faces/*.png 就绪后，cardAssets.js 中设 enabled=true 即可
GameCard.Face = function Face({ card, className = '', style = {} }) {
  const suit = card.suit
  const rank = card.rank
  const imgUrl = faceImage(rank, suit)

  if (imgUrl) {
    return (
      <div className={`w-full h-full rounded-[4px] overflow-hidden bg-white ${className}`} style={style}>
        <img src={imgUrl} alt={`${RANK_LABELS[rank]}${SUIT_SYMBOLS[suit]}`} className="w-full h-full object-cover rounded-[4px]" />
      </div>
    )
  }

  return (
    <div
      className={`w-full h-full bg-white rounded-[4px] border border-slate-200 flex flex-col justify-between p-0.5 select-none ${SUIT_COLORS[suit]} ${className}`}
      style={style}
    >
      <div className="flex flex-col items-start">
        <span className="text-[10px] leading-tight font-bold">{RANK_LABELS[rank]}</span>
        <span className="text-[8px] leading-none">{SUIT_SYMBOLS[suit]}</span>
      </div>
      <div className="flex flex-col items-end self-end rotate-180">
        <span className="text-[10px] leading-tight font-bold">{RANK_LABELS[rank]}</span>
        <span className="text-[8px] leading-none">{SUIT_SYMBOLS[suit]}</span>
      </div>
    </div>
  )
}

// 空牌位
GameCard.Empty = function Empty({ label = '', className = '', style = {} }) {
  return (
    <div
      className={`w-full h-full rounded-[4px] border-2 border-dashed border-slate-200 bg-white/50 flex items-center justify-center ${className}`}
      style={style}
    >
      {label && <span className="text-slate-300 text-[10px] font-bold">{label}</span>}
    </div>
  )
}
