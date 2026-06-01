import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import GameCard from '../components/GameCard'

const SUITS = ['S', 'H', 'C', 'D']
const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦' }
const SUIT_COLORS = { S: 'text-gray-900', H: 'text-red-600', C: 'text-gray-900', D: 'text-red-600' }
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const ROWS = 7
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
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function cardValue(rank) {
  return rank + 1
}

function dealInitial(shuffled) {
  const pyramid = []
  let idx = 0
  for (let row = 0; row < ROWS; row++) {
    const rowCards = []
    for (let col = 0; col <= row; col++) {
      rowCards.push({ ...shuffled[idx], row, col, removed: false })
      idx++
    }
    pyramid.push(rowCards)
  }
  const stock = shuffled.slice(idx).map(c => ({ ...c }))
  return { pyramid, stock }
}

function isCardExposed(pyramid, row, col) {
  if (row === ROWS - 1) return true
  const left = pyramid[row + 1][col]
  const right = pyramid[row + 1][col + 1]
  return left.removed && right.removed
}

function getExposedCards(pyramid, waste) {
  const list = []
  for (let r = 0; r < pyramid.length; r++) {
    for (let c = 0; c < pyramid[r].length; c++) {
      const card = pyramid[r][c]
      if (!card.removed && isCardExposed(pyramid, r, c)) {
        list.push({ ...card, source: 'pyramid', _row: r, _col: c })
      }
    }
  }
  if (waste.length > 0) {
    list.push({ ...waste[waste.length - 1], source: 'waste' })
  }
  return list
}

function hasValidMoves(pyramid, stock, waste) {
  const exposed = getExposedCards(pyramid, waste)
  for (let i = 0; i < exposed.length; i++) {
    if (cardValue(exposed[i].rank) === 13) return true
    for (let j = i + 1; j < exposed.length; j++) {
      if (cardValue(exposed[i].rank) + cardValue(exposed[j].rank) === 13) return true
    }
  }
  if (stock.length > 0) return true
  return false
}

function isPyramidCleared(pyramid) {
  return pyramid.every(row => row.every(c => c.removed))
}

export default function Pyramid() {
  const navigate = useNavigate()
  const [state, setState] = useState('ready')
  const [error, setError] = useState(null)
  const [pyramid, setPyramid] = useState([])
  const [stock, setStock] = useState([])
  const [discard, setDiscard] = useState([])
  const [waste, setWaste] = useState([])
  const [selected, setSelected] = useState(null)
  const [removing, setRemoving] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const [cardsCleared, setCardsCleared] = useState(0)
  const [chainCurrent, setChainCurrent] = useState(0)
  const [chainMax, setChainMax] = useState(0)
  const [stockUsed, setStockUsed] = useState(0)
  const [score, setScore] = useState(0)
  const [gameSessionId, setGameSessionId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [showRules, setShowRules] = useState(() => !localStorage.getItem('pyramid_rules_seen'))
  const timerRef = useRef(null)
  const toastTimer = useRef(null)
  const [toast, setToast] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const stateRef = useRef(state)
  const pyramidRef = useRef(pyramid)
  const stockRef = useRef(stock)
  const wasteRef = useRef(waste)
  stateRef.current = state

  const closeRules = useCallback(() => {
    setShowRules(false)
    localStorage.setItem('pyramid_rules_seen', '1')
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev, {
      pyramid: pyramidRef.current.map(row => row.map(c => ({...c}))),
      stock: stockRef.current.map(c => ({...c})),
      waste: wasteRef.current.map(c => ({...c})),
      cardsCleared,
      chainCurrent,
      chainMax,
      score,
      stockUsed,
      elapsed,
    }])
  }, [cardsCleared, chainCurrent, chainMax, score, stockUsed, elapsed])

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setPyramid(last.pyramid)
    setStock(last.stock)
    setWaste(last.waste)
    setCardsCleared(last.cardsCleared)
    setChainCurrent(last.chainCurrent)
    setChainMax(last.chainMax)
    setScore(last.score)
    setStockUsed(last.stockUsed)
    setElapsed(last.elapsed)
    setUndoStack(prev => prev.slice(0, -1))
    setSelected(null)
  }, [undoStack])



const handleStart = useCallback(() => {
    setState('loading')
    api.gamePlay('pyramid').then(data => {
      const rng = mulberry32(data.seed)
      const deck = createDeck()
      const shuffled = shuffle(deck, rng)
      const { pyramid: p, stock: s, discard: d } = dealInitial(shuffled)
      setPyramid(p)
      setStock(s)
      setDiscard(d)
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

  const calcScore = useCallback((cleared, chain, stk) => {
    const baseCleared = cleared * 2
    const clearBonus = cleared >= 28 ? 20 : 0
    const chainBonus = chain >= 2 ? (chain - 1) * 2 : 0
    const stockBonus = clearBonus > 0 ? stk : 0
    return baseCleared + clearBonus + chainBonus + stockBonus
  }, [])

  const submitScore = useCallback(async (isWin, finalScore, cleared, chain, used) => {
    try {
      await api.gameScore('pyramid', {
        score: finalScore,
        duration: elapsed,
        timestamp: new Date().toISOString(),
        is_win: isWin,
        cards_cleared: cleared,
        chain_max: chain,
        stock_used: used,
      })
    } catch (e) {
      console.error('Score submission failed:', e)
    }
  }, [elapsed])

  const applyRemove = useCallback((cardsToRemove) => {
    setRemoving(cardsToRemove.map(c => c.id))
    setTimeout(() => {
      setRemoving([])
      setSelected(null)
    }, 350)
  }, [])

  const doRemove = useCallback((cardsToRemove) => {
    const pyramid = pyramidRef.current
    const waste = wasteRef.current
    const stock = stockRef.current
    const newPyramid = pyramid.map(row => row.map(c => ({ ...c })))
    const newWaste = [...waste]
    let removedCount = 0

    for (const card of cardsToRemove) {
      if (card.source === 'pyramid') {
        newPyramid[card._row][card._col].removed = true
      } else if (card.source === 'waste') {
        newWaste.pop()
      }
      removedCount++
    }

    const newCleared = cardsCleared + removedCount
    const newChain = chainCurrent + 1
    const newChainMax = Math.max(chainMax, newChain)
    const newStockUsed = stockUsed

    const newScore = calcScore(newCleared, newChain, stock.length)

    setPyramid(newPyramid)
    setWaste(newWaste)
    setCardsCleared(newCleared)
    setChainCurrent(newChain)
    setChainMax(newChainMax)
    setScore(newScore)

    pushUndo()
    applyRemove(cardsToRemove)

    if (isPyramidCleared(newPyramid)) {
      const finalScore = newScore + stock.length
      setScore(finalScore)
      setState('won')
      submitScore(true, finalScore, newCleared, newChainMax, newStockUsed)
    } else if (!hasValidMoves(newPyramid, stock, newWaste)) {
      setState('lost')
      submitScore(false, newScore, newCleared, newChainMax, newStockUsed)
    }
  }, [cardsCleared, chainCurrent, chainMax, stockUsed, calcScore, submitScore, applyRemove])

  const handleCardClick = useCallback((card) => {
    if (stateRef.current !== 'playing') return

    if (cardValue(card.rank) === 13) {
      doRemove([card])
      return
    }

    if (selected === null) {
      setSelected(card)
      return
    }

    if (selected.id === card.id) {
      setSelected(null)
      return
    }

    const sum = cardValue(selected.rank) + cardValue(card.rank)
    if (sum === 13) {
      doRemove([selected, card])
      setSelected(null)
    } else {
      showToast('两张牌之和必须为 13')
      setSelected(card)
    }
  }, [selected, doRemove])

  const handleWasteClick = useCallback(() => {
    const waste = wasteRef.current
    if (stateRef.current !== 'playing' || waste.length === 0) return
    const wCard = { ...waste[waste.length - 1], source: 'waste' }
    handleCardClick(wCard)
  }, [handleCardClick])

  const dealStock = useCallback(() => {
    const stock = stockRef.current
    const waste = wasteRef.current
    const pyramid = pyramidRef.current
    if (stateRef.current !== 'playing') return
    if (stock.length === 0) { showToast('牌堆已空'); return }
    const newWaste = [...waste, stock[0]]
    const newStock = stock.slice(1)
    pushUndo()
    setWaste(newWaste)
    setStock(newStock)
    setStockUsed(s => s + 1)
    setChainCurrent(0)
    setSelected(null)

    if (!hasValidMoves(pyramid, newStock, newWaste)) {
      const s = calcScore(cardsCleared, 0, newStock.length)
      setState('lost')
      submitScore(false, s, cardsCleared, chainMax, stockUsed + 1)
    }
  }, [cardsCleared, chainMax, stockUsed, calcScore, submitScore])

  const giveUp = useCallback(() => {
    setState('lost')
    submitScore(false, score, cardsCleared, chainMax, stockUsed)
  }, [submitScore, score, cardsCleared, chainMax, stockUsed])

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
          <span className="text-xs text-white/60">金字塔纸牌</span>
          <span className="opacity-0 px-3">认输</span>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
            <div className="text-5xl mb-3">🔺</div>
            <h2 className="text-xl font-bold text-school mb-2">金字塔纸牌</h2>
            <p className="text-sm text-slate-500 mb-6">配对和为 13 消除金字塔，K 可以单独消除，挑战全消</p>
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
          <div className="text-3xl mb-2">🔺</div>
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
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
          <div className="text-5xl mb-3">{state === 'won' ? '🎉' : '😔'}</div>
          <h2 className="text-xl font-bold text-school mb-2">
            {state === 'won' ? '恭喜通关！' : '游戏结束'}
          </h2>
          <div className="space-y-1 text-sm text-slate-600 mb-4">
            <p>消除：{cardsCleared} / 28</p>
            <p>用时：{formatTime(elapsed)}</p>
            <p>得分：{score}</p>
            <p>最长连击：{chainMax}</p>
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

  const colSpacing = CARD_W + 4
  const rowHeight = 22
  const pyramidWidth = 7 * colSpacing

  return (
    <div className="min-h-screen bg-school-tint flex flex-col">
      <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-base leading-none">‹</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">金字塔纸牌</span>
        <button onClick={giveUp} className="text-schoolred-dark font-bold hover:opacity-80">认输</button>
      </header>

      <div className="flex justify-center px-3 py-2">
        <div className="bg-white rounded-xl shadow-sm px-4 py-1.5 flex items-center gap-4 text-xs text-slate-600">
          <span>🔺 {cardsCleared}/28</span>
          <span className="text-slate-300">|</span>
          <span>⚡ {chainCurrent}</span>
          <span className="text-slate-300">|</span>
          <span>⏱ {formatTime(elapsed)}</span>
          <span className="text-slate-300">|</span>
          <span>⭐ {score}</span>
          <button onClick={undo} disabled={undoStack.length === 0}
            className={`text-xs px-2 py-0.5 rounded ${undoStack.length > 0 ? 'text-schoolred-dark font-bold hover:opacity-80' : 'text-slate-400'}`}>
            ↩ 撤销
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start pt-3 pb-2 overflow-y-auto">
        <div className="relative" style={{ width: pyramidWidth, height: ROWS * rowHeight + CARD_H }}>
          {pyramid.map((row, r) =>
            row.map((card, c) => {
              if (card.removed) return null
              const exposed = isCardExposed(pyramid, r, c)
              const isSel = selected && selected.source === 'pyramid' && selected._row === r && selected._col === c
              const isRem = removing.includes(card.id)
              const leftOffset = (ROWS - 1 - r) * (colSpacing / 2) + c * colSpacing
              const topOffset = r * rowHeight
              return (
                <div
                  key={card.id}
                  className={`absolute rounded-[4px] border select-none transition-all duration-300
                    ${isRem ? 'scale-0 opacity-0' : ''}
                    ${isSel ? 'ring-2 ring-yellow-400 shadow-lg z-10' : ''}
                    ${exposed ? 'cursor-pointer hover:brightness-105' : 'cursor-default opacity-75'}
                    bg-white border-slate-300 shadow-sm`}
                  style={{ width: CARD_W, height: CARD_H, left: leftOffset, top: topOffset, zIndex: r }}
                  onClick={(e) => { e.stopPropagation(); if (exposed) handleCardClick({ ...card, source: 'pyramid', _row: r, _col: c }) }}
                >
                  <GameCard.Face card={card} className="border-0" />
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 mt-3">
          <div className="flex flex-col items-center">
            <div
              className={`relative rounded-[4px] border select-none cursor-pointer transition-colors overflow-hidden
                ${stock.length > 0
                  ? 'border-slate-300 hover:brightness-110'
                  : 'border-dashed border-slate-200 bg-transparent'}`}
              style={{ width: CARD_W, height: CARD_H }}
              onClick={dealStock}
            >
              {stock.length > 0 ? (
                <GameCard.Back className="rounded-none" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 text-[8px]">空</div>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">牌堆 {stock.length}</div>
          </div>

          <div className="flex flex-col items-center">
            {waste.length > 0 ? (() => {
              const wCard = waste[waste.length - 1]
              const isSel = selected && selected.source === 'waste' && selected.id === wCard.id
              const isRem = removing.includes(wCard.id)
              return (
                <div
                  className={`rounded-[4px] border select-none cursor-pointer transition-all duration-300
                    ${isRem ? 'scale-0 opacity-0' : ''}
                    ${isSel ? 'ring-2 ring-yellow-400 shadow-lg' : ''}
                    bg-white border-slate-300 shadow-sm hover:brightness-105`}
                  style={{ width: CARD_W, height: CARD_H }}
                  onClick={handleWasteClick}
                >
                  <GameCard.Face card={wCard} className="border-0" />
                </div>
              )
            })() : (
              <div className="rounded-[4px] border-2 border-dashed border-slate-200" style={{ width: CARD_W, height: CARD_H }} />
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">翻牌</div>
          </div>
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
            <h3 className="font-bold text-lg text-school mb-3">🔺 金字塔纸牌规则</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>目标：</strong>消除金字塔中的全部 28 张牌。</p>
              <p><strong>操作：</strong>点击已暴露的牌进行配对消除。</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>金字塔共 7 层，底行牌始终可点击</li>
                <li>上层牌仅当下方两张支撑牌均被移除后才可点击</li>
                <li>两张暴露牌点数之和为 13 即可消除</li>
                <li>K 点数为 13，可单独点击消除</li>
                <li>点数：A=1, 2-10=面值, J=11, Q=12, K=13</li>
              </ul>
              <p><strong>牌堆：</strong>点击牌堆翻一张牌到翻牌区，翻牌区顶牌可与金字塔暴露牌配对。</p>
              <p><strong>连击：</strong>不翻牌时连续消除，连击数越高奖励越多。</p>
              <p><strong>计分：</strong>每消一张 +2，全消奖励 +20，剩余牌堆每张 +1，连击额外加分。</p>
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
