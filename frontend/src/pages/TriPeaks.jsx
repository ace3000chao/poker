import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import GameCard from '../components/GameCard'
import { showToast as notify } from '../components/Toast'

const SUITS = ['S', 'H', 'C', 'D']
const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦' }
const SUIT_COLORS = { S: 'text-gray-900', H: 'text-red-600', C: 'text-gray-900', D: 'text-red-600' }
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const CARD_W = 52
const CARD_H = 72
const COL_DX = 24
const ROW_DY = 20
const PEAK_GAP = 8
const BOTTOM_ROW_WIDTH = CARD_W + 3 * COL_DX
const TOTAL_WIDTH = BOTTOM_ROW_WIDTH * 3 + PEAK_GAP * 2

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
      deck.push({ suit, rank, id: `${suit}_${rank}` })
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
  const peaks = [[], [], []]
  let idx = 0
  for (let p = 0; p < 3; p++) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        peaks[p].push({
          ...shuffled[idx],
          peak: p,
          row,
          col,
          removed: false,
        })
        idx++
      }
    }
  }
  const baseCard = { ...shuffled[idx] }
  idx++
  const stock = shuffled.slice(idx)
  return { peaks, baseCard, stock }
}

function isCardExposed(card, peakCards) {
  if (card.row === 0) return true
  const coverRow = card.row - 1
  for (const coverCol of [card.col - 1, card.col]) {
    if (coverCol >= 0 && coverCol <= coverRow) {
      if (peakCards.some(c => c.row === coverRow && c.col === coverCol && !c.removed)) {
        return false
      }
    }
  }
  return true
}

function isAdjacentRank(rank1, rank2) {
  const diff = Math.abs(rank1 - rank2)
  return diff === 1 || diff === 12
}

function getPlayableCards(peaks, baseRank) {
  const playable = []
  for (let p = 0; p < 3; p++) {
    for (const card of peaks[p]) {
      if (!card.removed && isCardExposed(card, peaks[p]) && isAdjacentRank(card.rank, baseRank)) {
        playable.push(card)
      }
    }
  }
  return playable
}

function getCardPosition(peak, row, col) {
  const peakSpan = BOTTOM_ROW_WIDTH + PEAK_GAP
  const peakStartX = peak * peakSpan
  const rowCardCount = row + 1
  const rowWidth = CARD_W + (rowCardCount - 1) * COL_DX
  const offset = (BOTTOM_ROW_WIDTH - rowWidth) / 2
  const x = peakStartX + offset + col * COL_DX
  const y = row * ROW_DY
  return { x, y }
}

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function TriPeaks() {
  const navigate = useNavigate()
  const [state, setState] = useState('ready')
  const [error, setError] = useState(null)
  const [peaks, setPeaks] = useState([[], [], []])
  const [baseCard, setBaseCard] = useState(null)
  const [stock, setStock] = useState([])
  const [chain, setChain] = useState(0)
  const [chainMax, setChainMax] = useState(0)
  const [chainBonusTotal, setChainBonusTotal] = useState(0)
  const [cardsCleared, setCardsCleared] = useState(0)
  const [stockUsed, setStockUsed] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [gameSessionId, setGameSessionId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [showRules, setShowRules] = useState(() => !localStorage.getItem('tripeaks_rules_seen'))
  const timerRef = useRef(null)
  const scoreSubmitted = useRef(false)
  const toastTimer = useRef(null)
  const [toast, setToast] = useState(null)
  const peaksRef = useRef(peaks)
  const stockRef = useRef(stock)
  const baseCardRef = useRef(baseCard)

  const playableCards = useMemo(() => {
    if (!baseCard || state !== 'playing') return []
    return getPlayableCards(peaks, baseCard.rank)
  }, [peaks, baseCard, state])

  const playableIds = useMemo(() => new Set(playableCards.map(c => c.id)), [playableCards])


  useEffect(() => { peaksRef.current = peaks }, [peaks])
  useEffect(() => { stockRef.current = stock }, [stock])
  useEffect(() => { baseCardRef.current = baseCard }, [baseCard])


const handleStart = useCallback(() => {
    setState('loading')
    api.gamePlay('tripeaks').then(data => {
      const rng = mulberry32(data.seed)
      const deck = createDeck()
      const shuffled = shuffle(deck, rng)
      const { peaks: p, stock: s, baseCard: b } = dealInitial(shuffled)
      setPeaks(p)
      setStock(s)
      setBaseCard(b)
      setGameSessionId(data.game_session_id)
      setStartedAt(data.started_at)
      setState('playing')
    }).catch(err => {
      setError(err.message)
      setState('error')
    })
  }, [])
  useEffect(() => {
    if (state === 'playing' && !showRules) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [state, showRules])

  useEffect(() => {
    if (state !== 'playing') return
    const allRemoved = peaks.flat().every(c => c.removed)
    if (allRemoved) {
      setState('won')
      return
    }
    if (playableCards.length === 0 && stock.length === 0) {
      showToast('已无可用操作')
      setTimeout(() => setState('lost'), 1500)
    }
  }, [peaks, stock, playableCards, state])

  const submitScore = useCallback((isWin) => {
    if (scoreSubmitted.current) return
    scoreSubmitted.current = true
    const score = cardsCleared * 10 + chainBonusTotal + (isWin ? 50 : 0) + stock.length * 3
    api.gameScore('tripeaks', {
      score,
      duration: elapsed,
      timestamp: new Date().toISOString(),
      is_win: isWin,
      chain_max: chainMax,
      stock_used: stockUsed,
      cards_cleared: cardsCleared,
    })
      .then(_r => notify(`积分 +${_r.earned_points} · 总分 ${_r.total_points} · 第 ${_r.rank} 名`, 'success'))
      .catch(e => notify(e?.message || '成绩上报失败,请检查网络后重试', 'error'))
  }, [cardsCleared, chainBonusTotal, stock, elapsed, chainMax, stockUsed])

  useEffect(() => {
    if (state === 'won') submitScore(true)
    if (state === 'lost') submitScore(false)
  }, [state, submitScore])

  const handleCardClick = useCallback((card) => {
    const peaks = peaksRef.current
    if (state !== 'playing') return
    if (!playableIds.has(card.id)) { showToast('必须选择相邻点数的牌'); return }

    const newChain = chain + 1
    const newChainBonus = chainBonusTotal + newChain * 2
    setChain(newChain)
    setChainMax(prev => Math.max(prev, newChain))
    setChainBonusTotal(newChainBonus)
    setCardsCleared(prev => prev + 1)
    setPeaks(prev => prev.map(peak =>
      peak.map(c => c.id === card.id ? { ...c, removed: true } : c)
    ))
    setBaseCard(card)
  }, [state, playableIds, chain, chainBonusTotal])

  const handleStockFlip = useCallback(() => {
    const stock = stockRef.current
    if (state !== 'playing') return
    if (stock.length === 0) { showToast('手牌已用完'); return }
    setBaseCard(stock[0])
    setStock(prev => prev.slice(1))
    setStockUsed(prev => prev + 1)
    setChain(0)
  }, [state])

  const giveUp = useCallback(() => {
    setState('lost')
  }, [])

  const closeRules = useCallback(() => {
    setShowRules(false)
    localStorage.setItem('tripeaks_rules_seen', '1')
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-school-tint flex flex-col">
        <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
          <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
            <span className="text-base leading-none">‹</span><span>返回</span>
          </button>
          <span className="text-xs text-white/60">三峰纸牌</span>
          <span className="opacity-0 px-3">认输</span>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
            <div className="text-5xl mb-3">🏔️</div>
            <h2 className="text-xl font-bold text-school mb-2">三峰纸牌</h2>
            <p className="text-sm text-slate-500 mb-6">三个金字塔等待清除，选择比基础牌大 1 或小 1 的牌，享受连锁消除的爽快感</p>
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
          <div className="text-3xl mb-2">🏔️</div>
          <div>发牌中...</div>
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
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-school text-white rounded-lg text-sm">
            返回
          </button>
        </div>
      </div>
    )
  }

  if (state === 'won' || state === 'lost') {
    const isWin = state === 'won'
    const finalScore = cardsCleared * 10 + chainBonusTotal + (isWin ? 50 : 0) + stock.length * 3
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
          <div className="text-5xl mb-3">{isWin ? '🎉' : '😔'}</div>
          <h2 className="text-xl font-bold text-school mb-2">
            {isWin ? '恭喜通关！' : '游戏结束'}
          </h2>
          <div className="space-y-1 text-sm text-slate-600 mb-4">
            <p>消除牌数：{cardsCleared} / 30</p>
            <p>最长连锁：{chainMax}</p>
            <p>翻牌次数：{stockUsed}</p>
            <p>用时：{formatTime(elapsed)}</p>
            <p className="font-bold text-school mt-2">得分：{finalScore}</p>
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

  const peaksHeight = 3 * ROW_DY + CARD_H

  return (
    <div className="min-h-screen bg-school-tint flex flex-col">
      <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-base leading-none">‹</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">三峰纸牌</span>
        <button onClick={giveUp} className="text-schoolred-dark font-bold hover:opacity-80">
          认输
        </button>
      </header>

      <div className="flex justify-center px-3 py-2">
        <div className="bg-white rounded-xl shadow-sm px-4 py-1.5 flex items-center gap-3 text-xs text-slate-600">
          <span>🏔 {cardsCleared}/30</span>
          <span className="text-slate-300">|</span>
          <span>⛓ {chain}</span>
          <span className="text-slate-300">|</span>
          <span>⏱ {formatTime(elapsed)}</span>
          <span className="text-slate-300">|</span>
          <button
            onClick={handleStockFlip}
            disabled={stock.length === 0}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all
              ${stock.length > 0
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'}
            `}
          >
            {stock.length > 0 ? `翻牌 ${stock.length}张` : '牌堆空'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center pt-3 pb-2 px-2 select-none overflow-x-auto">
        <div className="relative" style={{ width: TOTAL_WIDTH, height: peaksHeight }}>
          {peaks.map((peakCards, peakIdx) =>
            peakCards.map(card => {
              if (card.removed) return null
              const pos = getCardPosition(card.peak, card.row, card.col)
              const isPlayable = playableIds.has(card.id)
              return (
                <div
                  key={card.id}
                  className={`absolute rounded-md border shadow-sm transition-shadow duration-150
                    ${isPlayable ? 'card-playable cursor-pointer hover:brightness-105' : 'cursor-default'}
                    bg-white border-slate-300`}
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    left: pos.x,
                    top: pos.y,
                    zIndex: 3 - card.row,
                  }}
                  onClick={(e) => { e.stopPropagation(); handleCardClick(card) }}
                >
                  <GameCard.Face card={card} className="border-0" />
                </div>
              )
            }))}
          </div>

          <div className="flex flex-col items-center">
            <div className="text-xs text-slate-400 mb-1">基础牌</div>
            {baseCard ? (
              <GameCard.Face
                card={baseCard}
                className="border-amber-400 shadow-md"
                style={{ width: CARD_W, height: CARD_H }}
              />
            ) : (
              <GameCard.Empty style={{ width: CARD_W, height: CARD_H }} />
            )}
          </div>
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
            <h3 className="font-bold text-lg text-school mb-3">🏔️ 三峰纸牌规则</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>目标：</strong>消除三个金字塔上的所有30张牌。</p>
              <p><strong>基本规则：</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>选择与基础牌点数相差1的牌（A和K相连）</li>
                <li>被选中的牌成为新的基础牌</li>
                <li>只有未被覆盖的牌才能选择</li>
                <li>连续消除会形成连锁，连锁越长分数越高</li>
              </ul>
              <p><strong>翻牌：</strong>无牌可出时，点击牌堆翻出新基础牌（连锁重置）。</p>
              <p><strong>胜负：</strong>消除全部30张牌为胜利；牌堆用尽且无可出牌为失败。</p>
              <p><strong>计分：</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>每消除1张牌：+10分</li>
                <li>连锁第n张：+n×2分</li>
                <li>全部清除：+50分</li>
                <li>剩余牌堆每张：+3分</li>
              </ul>
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