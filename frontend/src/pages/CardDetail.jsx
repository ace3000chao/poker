import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, getToken } from '../api'

const SUIT_SYMBOL = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' }
const SUIT_COLOR = {
  hearts: 'text-hearts',
  spades: 'text-spades',
  clubs: 'text-clubs',
  diamonds: 'text-diamonds',
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="flex py-2.5 border-b border-school/10 text-sm">
      <span className="w-24 text-slate-400 shrink-0">{label}</span>
      <span className="flex-1 text-school-deep">{value}</span>
    </div>
  )
}

export default function CardDetail() {
  const { key } = useParams()
  const [card, setCard] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    api
      .getCard(key)
      .then(setCard)
      .catch((e) => setErr(e))
  }, [key])

  if (err) {
    // 40101 未登录(游客) / 40302 待审核 / 其它
    const guest = err.code === 40101
    const pending = err.code === 40302
    return (
      <div className="max-w-sm mx-auto p-8 text-center animate-pageIn">
        <div className="text-5xl mb-3">{pending ? '⏳' : '🔒'}</div>
        <h2 className="text-lg font-bold text-school-deep mb-1">
          {guest ? '登录后查看校友档案' : pending ? '资料审核中' : '无法查看'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {guest
            ? '校友详情仅对注册用户开放,登录或注册后即可查看'
            : pending ? '你的注册资料正在审核,通过后即可查看校友详情' : err.message}
        </p>
        {guest && (
          <div className="flex gap-3 justify-center mb-4">
            <Link to="/login" className="px-6 py-2 rounded-full bg-school text-white text-sm font-semibold">去登录</Link>
            <Link to="/register" className="px-6 py-2 rounded-full bg-gold/20 text-gold-dark text-sm font-semibold">去注册</Link>
          </div>
        )}
        <Link to="/" className="text-school text-sm underline">返回牌墙</Link>
      </div>
    )
  }
  if (!card)
    return <p className="p-8 text-center text-school animate-pulse">加载中…</p>

  const sym = SUIT_SYMBOL[card.suit]
  const color = SUIT_COLOR[card.suit] || 'text-school'
  const name = card.alumni_name?.replace(/【占位】/, '')

  const metaLine = [card.position, card.company_name].filter(Boolean).join(' · ')

  return (
    <div className="max-w-screen-sm mx-auto p-4 animate-pageIn">
      {/* 牌面头卡 */}
      <div className="relative rounded-3xl bg-white shadow-card overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-school to-school-mid" />
        <div className={`absolute top-5 left-4 leading-none ${color}`}>
          <div className="text-xl font-extrabold">{card.rank}</div>
          <div className="text-lg">{sym}</div>
        </div>
        <div className={`absolute top-5 right-4 leading-none ${color} text-right`}>
          <div className="text-xl font-extrabold">{card.rank}</div>
          <div className="text-lg">{sym}</div>
        </div>

        {card.card_image_url && (
          <img
            src={card.card_image_url}
            alt={name}
            className="w-full max-h-[420px] object-contain bg-school-light"
          />
        )}

        <div className="flex flex-col items-center pt-6 pb-6 px-6">
          {!card.card_image_url && (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-school-mid to-school flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white shadow-card">
              {name?.[0]}
            </div>
          )}
          <h1 className="mt-3 text-xl font-extrabold text-school-deep">{name}</h1>
          {metaLine && <p className="text-sm text-slate-500">{metaLine}</p>}
          {card.industry && (
            <span className="mt-2 text-xs px-3 py-1 rounded-full bg-school-light text-school-dark">
              {sym} {card.industry}
            </span>
          )}
        </div>

        {card.business_desc && (
          <p className="mx-6 mb-6 text-sm bg-school-light/60 rounded-2xl p-4 text-school-deep leading-relaxed">
            {card.business_desc}
          </p>
        )}
      </div>

      {/* 详细信息 */}
      <div className="mt-4 rounded-2xl bg-white shadow-card p-5">
        <Field label="毕业年份" value={card.graduation_year} />
        <Field label="学院" value={card.college} />
        <Field label="专业" value={card.major} />
        <Field label="公司地址" value={card.company_address} />
        <Field label="创立年份" value={card.founded_year} />
        <Field label="团队规模" value={card.team_size} />
        <Field label="联系电话" value={card.contact_phone} />
        <Field label="微信" value={card.wechat} />
        <Field label="邮箱" value={card.email} />
        <Field label="个人感言" value={card.alumni_quote} />
        {!getToken() && (
          <p className="pt-3 text-xs text-slate-400">
            登录后可查看联系方式 ·{' '}
            <Link to="/login" className="text-school underline">去登录</Link>
          </p>
        )}
      </div>

      <Link
        to="/"
        className="mt-5 block text-center py-3 rounded-full bg-school text-white font-semibold hover:bg-school-dark transition"
      >
        ‹ 返回扑克牌墙
      </Link>
    </div>
  )
}
