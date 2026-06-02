import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import GameCard from '../components/GameCard'
import { showToast as notify } from '../components/Toast'

const SUITS = ['S', 'H', 'C', 'D']
const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦' }
const SUIT_COLORS = { S: 'text-gray-900', H: 'text-red-600', C: 'text-gray-900', D: 'text-red-600' }
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_TO_POS_LABEL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const CARD_W = 44
const CARD_H = 60
const CLOCK_RADIUS = 128

const POSITIONS = [
  { x: 0, y: -1 },
  { x: 0.5, y: -0.87 },
  { x: 0.87, y: -0.5 },
  { x: 1, y: 0 },
  { x: 0.87, y: 0.5 },
  { x: 0.5, y: 0.87 },
  { x: 0, y: 1 },
  { x: -0.5, y: 0.87 },
  { x: -0.87, y: 0.5 },
  { x: -1, y: 0 },
  { x: -0.87, y: -0.5 },
  { x: -0.5, y: -0.87 },
]
const CENTER = { x: 0, y: 0 }

function pileToPosIdx(pileIdx) {
  if (pileIdx === 12) return -1
  return (pileIdx + 1) % 12
}

function mulberry32(seed) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (let rank = 0; rank < 13; rank++) {
      deck.push({ suit, rank, id: `${suit}${rank}` })
    }
  }
  return deck
}

function shuffle(deck, rng) {
  const a = [...deck]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function dealInitial(shuffled) {
  const piles = Array.from({ length: 13 }, () => [])
  shuffled.forEach((card, i) => {
    piles[i % 13].push(card)
  })
  return piles
}

export default function Clock() {
  const navigate = useNavigate()
  const [state, setState] = useState('ready')
  const [error, setError] = useState(null)
  const [piles, setPiles] = useState([])
  const [currentPile, setCurrentPile] = useState(12)
  const [revealed, setRevealed] = useState(0)
  const [revealedCard, setRevealedCard] = useState(null)
  const [gameSessionId, setGameSessionId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [showRules, setShowRules] = useState(() => !localStorage.getItem('clock_rules_seen'))
  const [autoPlay, setAutoPlay] = useState(false)
  const autoPlayRef = useRef(null)
  const timerRef = useRef(null)
  const stateRef = useRef({})
  const toastTimer = useRef(null)
  const [toast, setToast] = useState(null)

  const closeRules = useCallback(() => {
    setShowRules(false)
    localStorage.setItem('clock_rules_seen', '1')
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

const handleStart = useCallback(() => {
    setState('loading')
    api.gamePlay('clock').then(data => {
      const rng = mulberry32(data.seed)
      const deck = createDeck()
      const shuffled = shuffle(deck, rng)
      const p = dealInitial(shuffled)
      setPiles(p)
      setRevealed(0)
      setCurrentPile(0)
      setGameSessionId(data.game_session_id)
      setStartedAt(data.started_at)
      setState('playing')
    }).catch(err => {
      setError(err.message)
      setState('error')
    })
  }, [])

  // ---- pre-check availability on mount ----

  useEffect(() => {
    if (state === 'playing' && !showRules) {
      timerRef.current = setInterval(() => {
        setElapsed(e => e + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [state, showRules])

  const submitScore = useCallback(async (isWin, cardsRevealed) => {
    const score = isWin ? 100 : 10 + cardsRevealed
    try {
      const _r = await api.gameScore('clock', {
        score,
        duration: elapsed,
        timestamp: new Date().toISOString(),
        is_win: isWin,
        cards_revealed: cardsRevealed,
      })
      notify(`积分 +${_r.earned_points} · 总分 ${_r.total_points} · 第 ${_r.rank} 名`, 'success')
    } catch (e) {
      notify(e?.message || '成绩上报失败,请检查网络后重试', 'error')
    }
  }, [elapsed])

  const revealCard = useCallback(() => {
    if (state !== 'playing') return

    const curPiles = stateRef.current.piles || piles
    const curCurrent = stateRef.current.currentPile ?? currentPile
    const curRevealed = stateRef.current.revealed ?? revealed

    if (curPiles[curCurrent].length === 0) return

    const newPiles = curPiles.map(p => [...p])
    const card = newPiles[curCurrent].shift()
    const newRevealed = curRevealed + 1

    setRevealedCard(card)
    setRevealed(newRevealed)

    if (newRevealed === 52) {
      setPiles(newPiles)
      setState('won')
      submitScore(true, newRevealed)
      setAutoPlay(false)
      return
    }

    const nextPile = card.rank
    if (newPiles[nextPile].length === 0) {
      setPiles(newPiles)
      setCurrentPile(nextPile)
      setState('lost')
      submitScore(false, newRevealed)
      setAutoPlay(false)
      return
    }

    setPiles(newPiles)
    setCurrentPile(nextPile)
  }, [state, piles, currentPile, revealed, submitScore])

  useEffect(() => {
    stateRef.current = { piles, currentPile, revealed, state }
  }, [piles, currentPile, revealed, state])

  useEffect(() => {
    if (autoPlay && state === 'playing') {
      autoPlayRef.current = setTimeout(() => {
        revealCard()
      }, 300)
      return () => clearTimeout(autoPlayRef.current)
    }
  }, [autoPlay, state, piles, currentPile, revealed])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const getPos = (pileIdx) => {
    if (pileIdx === 12) return CENTER
    const posIdx = pileToPosIdx(pileIdx)
    return POSITIONS[posIdx]
  }

  const getPosLabel = (pileIdx) => {
    if (pileIdx === 12) return 'K'
    return RANK_TO_POS_LABEL[pileIdx]
  }

  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-school-tint flex flex-col">
        <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
          <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
            <span className="text-base leading-none">‹</span><span>返回</span>
          </button>
          <span className="text-xs text-white/60">时钟纸牌</span>
          <button className="opacity-0 px-3">认输</button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
            <div className="text-5xl mb-3">🕙</div>
            <h2 className="text-xl font-bold text-school mb-2">时钟纸牌</h2>
            <p className="text-sm text-slate-500 mb-6">纯运气翻牌游戏！牌摆成时钟形状，每次翻牌决定下一个钟点，挑战全部翻完</p>
              <button onClick={handleStart} className="px-8 py-3 bg-school text-white rounded-xl text-base font-semibold hover:bg-school-dark active:scale-95 transition-all shadow-md">开始游戏</button>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[70vh] text-school/60">
        <div className="text-center">
          <div className="text-3xl mb-2">🕙</div>
          <div>摆钟中...</div>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center text-schoolred p-6">
          <div className="text-3xl mb-2">⚠️</div>
          <div className="font-bold mb-1">无法开始游戏</div>
          <div className="text-sm text-slate-500">{error}</div>
          <button onClick={() => navigate('/games')} className="mt-4 px-4 py-2 bg-school text-white rounded-lg text-sm">
            返回
          </button>
        </div>
      </div>
    )
  }

  if (state === 'won' || state === 'lost') {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
          <div className="text-5xl mb-3">{state === 'won' ? '🎉' : '😔'}</div>
          <h2 className="text-xl font-bold text-school mb-2">
            {state === 'won' ? '恭喜通关！' : '游戏结束'}
          </h2>
          <div className="space-y-1 text-sm text-slate-600 mb-4">
            <p>已翻开：{revealed} / 52</p>
            <p>用时：{formatTime(elapsed)}</p>
            <p>得分：{state === 'won' ? 100 : 10 + revealed}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/games')} className="px-5 py-2 bg-school text-white rounded-lg text-sm">
              返回首页
            </button>
            <button onClick={() => window.location.reload()} className="px-5 py-2 bg-school-mid text-white rounded-lg text-sm">
              再来一局
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-school-tint flex flex-col">
      <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-base leading-none">‹</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">时钟纸牌</span>
        <button onClick={() => { setState('lost'); submitScore(false, revealed) }} className="text-schoolred-dark font-bold hover:opacity-80">
          认输
        </button>
      </header>

      <div className="flex justify-center px-3 py-2">
        <div className="bg-white rounded-xl shadow-sm px-4 py-1.5 flex items-center gap-3 text-xs text-slate-600 flex-wrap justify-center">
          <span>🕙 {revealed}/52</span>
          <span className="text-slate-300">|</span>
          <span>⏱ {formatTime(elapsed)}</span>
          {revealedCard && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-amber-600 font-bold">
                🃏 {RANK_LABELS[revealedCard.rank]}{SUIT_SYMBOLS[revealedCard.suit]} → {getPosLabel(revealedCard.rank)}点
              </span>
            </>
          )}
        </div>
      </div>
      {state === 'playing' && (
        <div className="text-center text-xs text-amber-600 font-medium -mt-1 mb-1">
          {revealedCard
            ? `请点击 ${getPosLabel(revealedCard.rank)}点 牌堆翻牌`
            : '请点击中心 K 堆开始翻牌'}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-2 py-3 select-none">
        <div className="relative" style={{ width: CLOCK_RADIUS * 2 + CARD_W + 20, height: CLOCK_RADIUS * 2 + CARD_H + 20 }}>
          <div
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%)`,
            }}
          >
            {piles.map((pile, pileIdx) => {
              const pos = getPos(pileIdx)
              const isCurrent = pileIdx === currentPile && state === 'playing'
              const posLabel = getPosLabel(pileIdx)
              const px = pos.x * CLOCK_RADIUS
              const py = pos.y * CLOCK_RADIUS
              const count = pile.length

              return (
                <div
                  key={pileIdx}
                  className="absolute"
                  style={{
                    left: px - CARD_W / 2,
                    top: py - CARD_H / 2,
                    width: CARD_W,
                    height: CARD_H,
                  }}
                >
                  {count > 0 ? (
                    <div
                      className={`w-full h-full rounded-[4px] border cursor-pointer overflow-hidden
                        transition-all duration-200
                        ${isCurrent
                          ? 'border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.7)] scale-110 z-20'
                          : 'border-slate-200 shadow-sm hover:shadow-md'
                        }`}
                        onClick={(e) => { e.stopPropagation(); if (isCurrent) revealCard(); else showToast('请点击当前点位') }}
                    >
                      <GameCard.Back className="rounded-none">
                        <div className="absolute top-1 left-1.5 text-[8px] font-bold text-white/70 leading-none">{posLabel}</div>
                        <div className="absolute bottom-1 right-1.5 text-[8px] font-bold text-white/70 leading-none rotate-180">{posLabel}</div>
                        <div className="absolute top-1 right-1 text-[7px] font-medium text-amber-400 leading-none">{count}</div>
                      </GameCard.Back>
                    </div>
                  ) : (
                    <GameCard.Empty label={posLabel} className={`cursor-pointer transition-all duration-200 ${isCurrent ? 'border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.7)] scale-110 z-20' : ''}`} />
                  )}
                </div>
              )
            })}


          </div>
        </div>
      </div>

      <div className="flex justify-center items-center gap-4 py-2 bg-white border-t border-slate-100">
        <button
          onClick={() => setAutoPlay(!autoPlay)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors
            ${autoPlay
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-school text-white hover:bg-school-dark'
            }`}
        >
          {autoPlay ? '⏸ 暂停' : '▶ 自动翻牌'}
        </button>
        <button
          onClick={() => {
            setAutoPlay(false)
            revealCard()
          }}
          disabled={autoPlay}
          className="px-4 py-1.5 bg-school-mid text-white rounded-lg text-xs font-bold
            disabled:opacity-30 disabled:cursor-not-allowed hover:bg-school-dark transition-colors"
        >
          翻牌
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
      <button
        onClick={() => setShowRules(true)}
        className="fixed bottom-20 right-4 z-30 bg-school text-white rounded-full shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 hover:bg-school-dark active:scale-95 transition-all"
      >
        📖 规则
      </button>

      {showRules && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={closeRules}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-school mb-3">🕙 时钟纸牌规则</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>目标：</strong>将全部 52 张牌翻开，即获得胜利！</p>
              <p><strong>摆牌：</strong>52 张牌分到 12 个钟点位置和中心位置，每个位置 4 张牌。</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>A→1点, 2→2点, …, 10→10点, J→11点, Q→12点</li>
                <li>K 放到中心位置</li>
              </ul>
              <p><strong>玩法：</strong></p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>从中心牌堆翻开第一张牌</li>
                <li>根据翻出牌的点数，将牌放到对应钟点位置</li>
                <li>从该位置翻开下一张牌，重复以上步骤</li>
                <li>若需要翻牌的位置已空 → 游戏结束（失败）</li>
                <li>若 52 张牌全部翻开 → 胜利！</li>
              </ol>
              <p><strong>提示：</strong>本游戏为纯运气游戏，胜率约 1/13，无需思考尽情享受！</p>
              <p><strong>计分：</strong>胜利 100 分，失败 10 + 翻开张数 分。</p>
            </div>
            <button onClick={closeRules} className="w-full mt-4 py-2 rounded-lg bg-school text-white text-sm font-semibold">
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
