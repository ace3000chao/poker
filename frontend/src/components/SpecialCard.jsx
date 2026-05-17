import { Link } from 'react-router-dom'

// 王牌:大王=中山职业技术学院,小王=创新创业学院。
// 比普通牌更尊贵:深蓝底 + 金色描边 + 皇冠,贴合"王牌"定位。
export default function SpecialCard({ card }) {
  const isKing = card.type === 'king'
  const monogram = card.title?.[0] || '王'

  return (
    <Link
      to={`/special/${card.type}`}
      className="group relative min-w-0 aspect-[3/4] rounded-2xl overflow-hidden
                 flex flex-col items-center justify-between p-4 text-white
                 bg-gradient-to-br from-school-deep via-school to-school-dark
                 ring-2 ring-[#E8B33A]/70 shadow-cardHover
                 hover:-translate-y-1 transition-all duration-200"
    >
      {/* 角标皇冠 */}
      <div className="absolute top-2.5 left-3 text-[#E8B33A] leading-none">
        <div className="text-sm font-extrabold">{isKing ? 'K' : 'JK'}</div>
        <div className="text-xs">♛</div>
      </div>
      <div className="absolute bottom-2.5 right-3 text-[#E8B33A] leading-none rotate-180">
        <div className="text-sm font-extrabold">{isKing ? 'K' : 'JK'}</div>
        <div className="text-xs">♛</div>
      </div>

      <span className="mt-3 text-[11px] tracking-[0.3em] text-[#E8B33A] font-semibold">
        {card.subtitle /* 大王 / 小王 */}
      </span>

      {/* 中心:大王用学校 logo,小王用字徽 */}
      <div className="flex-1 flex items-center justify-center">
        {isKing ? (
          <img
            src="/logo-zspt-white.png"
            alt={card.title}
            className="w-[78%] max-h-16 object-contain"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-white/10 ring-2 ring-[#E8B33A]/60
                          flex items-center justify-center text-3xl font-bold">
            {monogram}
          </div>
        )}
      </div>

      <p className="text-center text-[13px] font-bold leading-snug pb-2">
        {card.title}
      </p>
    </Link>
  )
}
