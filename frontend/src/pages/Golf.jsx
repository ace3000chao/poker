import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import GameCard from '../components/GameCard'

const SUITS = ['S', 'H', 'C', 'D']
const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦' }
const SUIT_COLORS = { S: 'text-gray-900', H: 'text-red-600', C: 'text-gray-900', D: 'text-red-600' }
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const COLS = 7
const ROWS = 5
const CARD_W = 52
const CARD_H = 72

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
  for (const suit of SUITS)
    for (let r = 0; r < 13; r++)
      deck.push({ suit, rank: r, id: `${suit}_${r}` })
  return deck
}

function shuffle(deck, rng) {
  const a = [...deck]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}


function dealInitial(shuffled) {
  const columns = Array.from({ length: 7 }, () => [])
  for (let i = 0; i < 35; i++) {
    columns[i % 7].push(shuffled[i])
  }
  const stock = shuffled.slice(35)
  const baseCard = stock.shift()
  return { columns, stock, baseCard }
}
function rankValue(rank) { return rank + 1 }

function isPlayable(card, base) {
  const diff = Math.abs(rankValue(card.rank) - rankValue(base.rank))
  return diff === 1 || diff === 12
}

function getPlayableIndices(columns, base) {
  const indices = []
  for (let c = 0; c < columns.length; c++) {
    if (columns[c].length === 0) continue
    const top = columns[c][columns[c].length - 1]
    if (isPlayable(top, base)) indices.push(c)
  }
  return indices
}

export default function Golf() {
  const navigate = useNavigate()
  const [state, setState] = useState('ready')
  const [error, setError] = useState(null)
  const [columns, setColumns] = useState([])
  const [stock, setStock] = useState([])
  const [baseCard, setBaseCard] = useState(null)
  const [base, setBase] = useState(null)
  const [cleared, setCleared] = useState(0)
  const [stockUsed, setStockUsed] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [gameSessionId, setGameSessionId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [showRules, setShowRules] = useState(() => !localStorage.getItem('golf_rules_seen'))
  const [settings, setSettings] = useState(null)
  const [removeAnim, setRemoveAnim] = useState(null)
  const timerRef = useRef(null)
  const toastTimer = useRef(null)
  const [toast, setToast] = useState(null)
  const columnsRef = useRef(columns)
  const stockRef = useRef(stock)
  const baseRef = useRef(base)

  const closeRules = useCallback(() => {
    setShowRules(false)
    localStorage.setItem('golf_rules_seen', '1')
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])


  useEffect(() => { columnsRef.current = columns }, [columns])
  useEffect(() => { stockRef.current = stock }, [stock])
  useEffect(() => { baseRef.current = base }, [base])


const handleStart = useCallback(() => {
    setState('loading')
    api.gamePlay('golf').then(data => {
      const rng = mulberry32(data.seed)
      const deck = createDeck()
      const shuffled = shuffle(deck, rng)
      const { columns: cols, stock: s, baseCard: b } = dealInitial(shuffled)
      setColumns(cols)
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

  const handleCardClick = useCallback((colIdx) => {
    const columns = columnsRef.current
    const base = baseRef.current
    if (state !== 'playing') return
    const col = columns[colIdx]
    if (!col || col.length === 0) return
    const card = col[col.length - 1]
    if (!isPlayable(card, base)) { showToast('必须选择相邻点数的牌'); return }
    setRemoveAnim({ col: colIdx, row: col.length - 1 })
    const newCols = columns.map((c, i) => i === colIdx ? c.slice(0, -1) : c)
    setColumns(newCols)
    setBase(card)
    const newCleared = cleared + 1
    setCleared(newCleared)
    if (newCleared >= 35) {
      setState('won')
    }
    setTimeout(() => setRemoveAnim(null), 200)
  }, [cleared, state])

  const handleStockClick = useCallback(() => {
    const stock = stockRef.current
    if (state !== 'playing') return
    if (stock.length === 0) { showToast('手牌已用完'); return }
    const newBase = stock[0]
    setBase({ ...newBase, faceUp: true })
    setStock(stock.slice(1))
    setStockUsed(u => u + 1)
    
  }, [cleared, state])

  useEffect(() => {
    if (state !== 'playing' || !base) return
    const playable = getPlayableIndices(columns, base)
    if (playable.length === 0 && stock.length === 0 && cleared < 35) {
      showToast('已无可用操作')
      setTimeout(() => setState('lost'), 1500)
    }
  }, [columns, stock, base, cleared, state])

  const submitScore = useCallback(async (isWin) => {
    const score = cleared + (isWin ? 30 : 0) + (isWin ? stock.length * 2 : 0)
    try {
      await api.gameScore('golf', {
        score,
        duration: elapsed,
        timestamp: new Date().toISOString(),
        is_win: isWin,
        cards_cleared: cleared,
        stock_used: stockUsed,
      })
    } catch (e) {
      console.error('Score submission failed:', e)
    }
  }, [cleared, elapsed, stockUsed, stock])

  useEffect(() => {
    if (state === 'won') submitScore(true)
    if (state === 'lost') submitScore(false)
  }, [state])

  const giveUp = useCallback(() => {
    setState('lost')
  }, [])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-school-tint flex flex-col">
        <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
          <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
            <span className="text-base leading-none">‹</span><span>返回</span>
          </button>
          <span className="text-xs text-white/60">高尔夫纸牌</span>
          <span className="opacity-0 px-3">认输</span>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
            <div className="text-5xl mb-3">⛳</div>
            <h2 className="text-xl font-bold text-school mb-2">高尔夫纸牌</h2>
            <p className="text-sm text-slate-500 mb-6">极速消除！7 列牌中依次选择比基础牌大 1 或小 1 的牌，全部消除即一杆进洞</p>
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
          <div className="text-3xl mb-2">⛳</div>
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
    const score = cleared + (isWin ? 30 : 0) + (isWin ? stock.length * 2 : 0)
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
          <div className="text-5xl mb-3">{isWin ? '🎉' : '😔'}</div>
          <h2 className="text-xl font-bold text-school mb-2">
            {isWin ? '一杆进洞！' : '游戏结束'}
          </h2>
          <div className="space-y-1 text-sm text-slate-600 mb-4">
            <p>已消除：{cleared} / 35</p>
            <p>用时：{formatTime(elapsed)}</p>
            <p>得分：{score}</p>
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

  const playableIdxs = base ? getPlayableIndices(columns, base) : []
  const totalRemaining = columns.reduce((s, c) => s + c.length, 0)

  return (
    <div className="min-h-screen bg-school-tint flex flex-col">
      <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-base leading-none">‹</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">高尔夫纸牌</span>
        <button onClick={giveUp} className="text-schoolred-dark font-bold hover:opacity-80">
          认输
        </button>
      </header>

      <div className="flex justify-center px-3 py-2">
        <div className="bg-white rounded-xl shadow-sm px-4 py-1.5 flex items-center gap-3 text-xs text-slate-600">
          <span>⛳ {cleared}/35</span>
          <span className="text-slate-300">|</span>
          <span>⏱ {formatTime(elapsed)}</span>
          <span className="text-slate-300">|</span>
          <button
            onClick={handleStockClick}
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

      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col items-center">
        {/* Tableau */}
        <div className="flex gap-1 justify-center mb-3">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col items-center">
              {col.length === 0 ? (
                <div
                  className="rounded-[5px] border-2 border-dashed border-slate-200"
                  style={{ width: CARD_W, height: CARD_H }}
                />
              ) : (
                col.map((card, rowIdx) => {
                  const isTop = rowIdx === col.length - 1
                  const isPlayable = isTop && playableIdxs.includes(colIdx)
                  const isRemoving = removeAnim && removeAnim.col === colIdx && removeAnim.row === rowIdx
                  return (
                    <div
                      key={card.id}
                      className={`rounded-[4px] border bg-white select-none
                        ${isPlayable ? 'ring-2 ring-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] cursor-pointer' : 'border-slate-200'}
                        ${isRemoving ? 'scale-75 opacity-0' : ''}
                        transition-all duration-150`}
                      style={{
                        width: CARD_W,
                        height: CARD_H,
                        marginTop: rowIdx > 0 ? -CARD_H + 14 : 0,
                        zIndex: rowIdx,
                      }}
                      onClick={(e) => { e.stopPropagation(); if (isTop) handleCardClick(colIdx) }}
                    >
                      <GameCard.Face card={card} className="border-0" />
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
        {/* Base & Stock area */}
        <div className="flex items-center gap-6 mb-3">
          <div className="text-center">
            <div className="text-[10px] text-slate-400 mb-1">基础牌</div>
            {base ? (
              <GameCard.Face card={base} className="shadow-sm" style={{ width: CARD_W, height: CARD_H }} />
            ) : (
              <GameCard.Empty label="—" style={{ width: CARD_W, height: CARD_H }} />
            )}
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-400 mb-1">牌堆 ({stock.length})</div>
            <button
              onClick={handleStockClick}
              disabled={stock.length === 0}
              className={`rounded-[4px] border flex items-center justify-center transition-colors overflow-hidden
                ${stock.length > 0
                  ? 'border-slate-300 cursor-pointer hover:shadow-md'
                  : 'bg-slate-100 border-slate-200 cursor-not-allowed'}`}
              style={{ width: CARD_W, height: CARD_H }}
            >
              {stock.length > 0 ? (
                <GameCard.Back className="rounded-none" />
              ) : (
                <span className="text-slate-300 text-xs">空</span>
              )}
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="text-xs text-slate-400">
          剩余 {totalRemaining} 张可消除牌 | 牌堆剩余 {stock.length}
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
            <h3 className="font-bold text-lg text-school mb-3">⛳ 高尔夫纸牌规则</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>目标：</strong>消除牌面全部 35 张牌（7列×5行）。</p>
              <p><strong>操作：</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>7列牌中，每列最底部的牌可以点击</li>
                <li>只有与基础牌点数相差 1 的牌可以消除（A↔K 也算）</li>
                <li>点击可消除的牌，该牌成为新基础牌</li>
                <li>没有可消除的牌时，点击牌堆翻出新的基础牌</li>
              </ul>
              <p><strong>胜利：</strong>35 张牌全部消除。</p>
              <p><strong>失败：</strong>牌堆用尽且无可消除的牌。</p>
              <p><strong>计分：</strong>每消除 1 张 +1 分，全清 +30 奖励，剩余牌堆每张 +2。</p>
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