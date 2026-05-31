import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'

function clean(v) {
  return v ? v.replace(/【占位】?/g, '').trim() : ''
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="flex py-2.5 border-b border-school/10 text-sm">
      <span className="w-20 text-slate-400 shrink-0">{label}</span>
      <span className="flex-1 text-school-deep break-all">{value}</span>
    </div>
  )
}

export default function SpecialDetail() {
  const { type } = useParams()
  const [card, setCard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .listSpecial()
      .then((d) => {
        const found = (d.items || []).find((x) => x.type === type)
        if (!found) setError('未找到该王牌')
        else setCard(found)
      })
      .catch((e) => setError(e.message))
  }, [type])

  if (error)
    return (
      <div className="p-8 text-center">
        <p className="text-schoolred">{error}</p>
        <Link to="/" className="text-school text-sm underline mt-4 inline-block">
          返回牌墙
        </Link>
      </div>
    )
  if (!card)
    return <p className="p-8 text-center text-school animate-pulse">加载中…</p>

  const isKing = card.type === 'king'

  return (
    <div className="max-w-screen-sm mx-auto p-4 animate-pageIn">
      <div className="relative rounded-3xl overflow-hidden shadow-cardHover
                      bg-gradient-to-br from-school-deep via-school to-school-dark
                      text-white ring-2 ring-[#E8B33A]/70">
        <div className="px-6 pt-7 pb-6 flex flex-col items-center">
          <span className="text-[11px] tracking-[0.3em] text-[#E8B33A] font-semibold">
            {card.subtitle} · 王牌
          </span>
          {card.card_image_url ? (
            <img
              src={card.card_image_url}
              alt={card.title}
              className="w-[70%] max-h-72 object-contain my-5 rounded-xl"
            />
          ) : isKing ? (
            <img
              src="/logo-zspt-white.png"
              alt={card.title}
              className="w-[70%] max-h-20 object-contain my-5"
            />
          ) : (
            <div className="w-20 h-20 my-5 rounded-full bg-white/10 ring-2 ring-[#E8B33A]/60
                            flex items-center justify-center text-4xl font-bold">
              {card.title?.[0]}
            </div>
          )}
          <h1 className="text-xl font-extrabold">{card.title}</h1>
          {clean(card.motto) && (
            <p className="mt-2 text-sm text-white/80">{clean(card.motto)}</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white shadow-card p-5">
        {clean(card.description) && (
          <p className="text-sm text-school-deep leading-relaxed mb-3">
            {clean(card.description)}
          </p>
        )}
        <Field label="联系电话" value={card.contact_phone} />
        <Field label="邮箱" value={card.contact_email} />
        <Field label="地址" value={card.address} />
        {card.website_url && (
          <div className="flex py-2.5 text-sm">
            <span className="w-20 text-slate-400 shrink-0">官网</span>
            <a
              href={card.website_url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-school underline break-all"
            >
              {card.website_url}
            </a>
          </div>
        )}
        {!clean(card.description) &&
          !card.contact_phone &&
          !card.address && (
            <p className="text-xs text-slate-400 text-center py-2">
              详细资料待学校提供后补充
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
