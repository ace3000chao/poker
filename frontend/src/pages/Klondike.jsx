import { useState, useEffect, useRef, useCallback } from 'react'
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
const FACE_DOWN_OFFSET = 14
const FACE_UP_OFFSET = 22

function mulberry32(seed) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isRed(suit) { return suit === 'H' || suit === 'D' }

function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (let rank = 0; rank < 13; rank++) {
      deck.push({ suit, rank, id: `${suit}_${rank}`, faceUp: false })
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

function dealInitial(shuffled) {
  const tableau = Array.from({ length: 7 }, () => [])
  let idx = 0
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...shuffled[idx], faceUp: row === col }
      tableau[col].push(card)
      idx++
    }
  }
  const stock = shuffled.slice(idx).map(c => ({ ...c, faceUp: false }))
  const waste = []
  const foundations = [[], [], [], []]
  return { tableau, stock, waste, foundations }
}

function canMoveToTableau(card, targetBottom) {
  if (!targetBottom) return true
  return isRed(card.suit) !== isRed(targetBottom.suit) && card.rank === targetBottom.rank - 1
}

function canMoveToFoundation(card, foundation) {
  if (foundation.length === 0) return card.rank === 0
  const top = foundation[foundation.length - 1]
  return card.suit === top.suit && card.rank === top.rank + 1
}

function getMovableGroup(column, cardIndex) {
  const group = []
  for (let i = cardIndex; i < column.length; i++) {
    const card = column[i]
    if (!card.faceUp) return null
    if (group.length > 0) {
      const prev = group[group.length - 1]
      if (isRed(card.suit) === isRed(prev.suit) || card.rank !== prev.rank - 1) return null
    }
    group.push(card)
  }
  return group
}

function findFoundationForCard(card, foundations) {
  for (let i = 0; i < 4; i++) {
    if (canMoveToFoundation(card, foundations[i])) return i
  }
  return -1
}

export default function Klondike() {
  const navigate = useNavigate()
  const [state, setState] = useState('ready')
  const [error, setError] = useState(null)
  const [tableau, setTableau] = useState([])
  const [stock, setStock] = useState([])
  const [waste, setWaste] = useState([])
  const [foundations, setFoundations] = useState([[], [], [], []])
  const [selected, setSelected] = useState(null)
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [drawMode, setDrawMode] = useState(1)
  const [difficulty, setDifficulty] = useState(null)
  const [stockResets, setStockResets] = useState(0)
  const [gameSessionId, setGameSessionId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [showRules, setShowRules] = useState(() => !localStorage.getItem('klondike_rules_seen'))
  const [lastClickTime, setLastClickTime] = useState(0)
  const [lastClickTarget, setLastClickTarget] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const timerRef = useRef(null)
  const tableauRef = useRef(tableau)
  const stockRef = useRef(stock)
  const wasteRef = useRef(waste)
  const foundationsRef = useRef(foundations)
  const flippingIds = useRef(new Set())

  const pushUndo = useCallback(() => {
    setUndoStack(s => [...s, { tableau: JSON.parse(JSON.stringify(tableauRef.current)), stock: JSON.parse(JSON.stringify(stockRef.current)), waste: JSON.parse(JSON.stringify(wasteRef.current)), foundations: JSON.parse(JSON.stringify(foundationsRef.current)), moves: moves, stockResets: stockResets }])
  }, [moves, stockResets])

  const undo = useCallback(() => {
    setUndoStack(s => {
      if (s.length === 0) return s
      const snapshot = s[s.length - 1]
      setTableau(snapshot.tableau)
      setStock(snapshot.stock)
      setWaste(snapshot.waste)
      setFoundations(snapshot.foundations)
      setMoves(snapshot.moves)
      setStockResets(snapshot.stockResets)
      setSelected(null)
      return s.slice(0, -1)
    })
  }, [])

  const closeRules = useCallback(() => {
    setShowRules(false)
    localStorage.setItem('klondike_rules_seen', '1')
  }, [])

  const handleStart = useCallback(() => {
    setState('loading')
    const mode = drawMode
    api.gamePlay('klondike', { draw_mode: mode }).then(data => {
      const rng = mulberry32(data.seed)
      const deck = createDeck()
      const shuffled = shuffle(deck, rng)
      const { tableau: t, stock: s, waste: w, foundations: f } = dealInitial(shuffled)
      setTableau(t)
      setStock(s)
      setWaste(w)
      setFoundations(f)
      setGameSessionId(data.game_session_id)
      setStartedAt(data.started_at)
      setState('playing')
    }).catch(err => {
      setError(err.message)
      setState('error')
    })
  }, [drawMode])

  // ---- pre-check availability on mount ----

  useEffect(() => { tableauRef.current = tableau }, [tableau])
  useEffect(() => { stockRef.current = stock }, [stock])
  useEffect(() => { wasteRef.current = waste }, [waste])
  useEffect(() => { foundationsRef.current = foundations }, [foundations])

  useEffect(() => {
    if (state === 'playing' && !showRules) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [state, showRules])

  const flipTopCards = useCallback((newTableau) => {
    return newTableau.map(col => {
      if (col.length > 0 && !col[col.length - 1].faceUp) {
        const ncol = [...col]
        ncol[ncol.length - 1] = { ...ncol[ncol.length - 1], faceUp: true }
        return ncol
      }
      return col
    })
  }, [])

  const handleStockClick = useCallback(() => {
    const stock = stockRef.current
    const waste = wasteRef.current
    if (stock.length > 0) {
      const card = { ...stock[stock.length - 1], faceUp: true }
      setWaste([...waste, card])
      setStock(stock.slice(0, -1))
      setMoves(m => m + 1)
      setSelected(null)
    } else if (waste.length > 0) {
      setStock(waste.slice().reverse().map(c => ({ ...c, faceUp: false })))
      setWaste([])
      setStockResets(r => r + 1)
      setMoves(m => m + 1)
      setSelected(null)
    }
  }, [])

  const handleDoubleClick = useCallback((card, source, colIndex) => {
    const tableau = tableauRef.current
    const waste = wasteRef.current
    let newF = foundationsRef.current.map(pile => [...pile])
    const fi = findFoundationForCard(card, newF)
    if (fi === -1) return

    let newT = tableau.map(c => [...c])
    let newW = [...waste]

    newF[fi] = [...newF[fi], card]

    if (source === 'tableau') {
      newT[colIndex] = newT[colIndex].slice(0, -1)
      newT = flipTopCards(newT)
    } else if (source === 'waste') {
      newW = newW.slice(0, -1)
    }

    setFoundations(newF)
    setTableau(newT)
    setWaste(newW)
    setMoves(m => m + 1)
    setSelected(null)
  }, [flipTopCards])

  const handleTableauCardClick = useCallback((colIndex, cardIndex) => {
    const tableau = tableauRef.current
    const col = tableau[colIndex]
    const card = col[cardIndex]
    if (!card.faceUp) return

    const now = Date.now()
    const clickKey = `t_${colIndex}_${cardIndex}`
    if (now - lastClickTime < 350 && lastClickTarget === clickKey) {
      handleDoubleClick(card, 'tableau', colIndex)
      setLastClickTime(0)
      setLastClickTarget(null)
      return
    }
    setLastClickTime(now)
    setLastClickTarget(clickKey)

    if (selected) {
      if (selected.source === 'tableau' && selected.col === colIndex) {
        const newSel = selected.cardIndex === cardIndex ? null : { source: 'tableau', col: colIndex, cardIndex, cards: col.slice(cardIndex) }
        setSelected(newSel)
        return
      }

      const topCard = selected.cards[0]
      const targetBottom = col.length > 0 ? col[col.length - 1] : null
      if (selected.cards.length === 1 && canMoveToTableau(topCard, targetBottom) || selected.cards.length > 1 && canMoveToTableau(topCard, targetBottom)) {
        let newT = tableau.map(c => [...c])
    let newW = [...waste]
        let newF = foundationsRef.current.map(pile => [...pile])

        if (selected.source === 'tableau') {
          newT[selected.col] = newT[selected.col].slice(0, selected.cardIndex)
          newT[colIndex] = [...newT[colIndex], ...selected.cards]
        } else if (selected.source === 'waste') {
          newW = newW.slice(0, -1)
          newT[colIndex] = [...newT[colIndex], ...selected.cards]
        } else if (selected.source === 'foundation') {
          newF[selected.col] = newF[selected.col].slice(0, -1)
          newT[colIndex] = [...newT[colIndex], ...selected.cards]
        }

        newT = flipTopCards(newT)
        setTableau(newT)
        setWaste(newW)
        setFoundations(newF)
        setMoves(m => m + 1)
        setSelected(null)
      } else {
        const group = getMovableGroup(col, cardIndex)
        setSelected(group ? { source: 'tableau', col: colIndex, cardIndex, cards: group } : null)
      }
    } else {
      const currentTableau = tableauRef.current
      const currentCol = currentTableau[colIndex]
      const group = getMovableGroup(currentCol, cardIndex)
      if (group) setSelected({ source: 'tableau', col: colIndex, cardIndex, cards: group })
    }
  }, [lastClickTime, lastClickTarget, handleDoubleClick, flipTopCards])

  const handleEmptyTableauClick = useCallback((colIndex) => {
    const tableau = tableauRef.current
    const waste = wasteRef.current
    if (!selected) return
    const topCard = selected.cards[0]
    if (topCard.rank !== 12) {
      setSelected(null)
      return
    }
    let newT = tableau.map(c => [...c])
    let newW = [...waste]
    let newF = foundationsRef.current.map(pile => [...pile])

    if (selected.source === 'tableau') {
      const movingCards = newT[selected.col].slice(selected.cardIndex)
      newT[selected.col] = newT[selected.col].slice(0, selected.cardIndex)
      newT[colIndex] = [...movingCards]
    } else if (selected.source === 'waste') {
      newW = newW.slice(0, -1)
      newT[colIndex] = [...selected.cards]
    } else if (selected.source === 'foundation') {
      newF[selected.col] = newF[selected.col].slice(0, -1)
      newT[colIndex] = [...selected.cards]
    }

    newT = flipTopCards(newT)
    setTableau(newT)
    setWaste(newW)
    setFoundations(newF)
    setMoves(m => m + 1)
    setSelected(null)
  }, [selected, flipTopCards])

  const handleWasteClick = useCallback(() => {
    const waste = wasteRef.current
    if (waste.length === 0) return
    const card = waste[waste.length - 1]

    const now = Date.now()
    const clickKey = 'waste'
    if (now - lastClickTime < 350 && lastClickTarget === clickKey) {
      handleDoubleClick(card, 'waste', -1)
      setLastClickTime(0)
      setLastClickTarget(null)
      return
    }
    setLastClickTime(now)
    setLastClickTarget(clickKey)

    if (selected && selected.source === 'waste') {
      setSelected(null)
      return
    }
    setSelected({ source: 'waste', col: -1, cardIndex: waste.length - 1, cards: [card] })
  }, [selected, lastClickTime, lastClickTarget, handleDoubleClick])

  const handleFoundationClick = useCallback((fi) => {
    const foundations = foundationsRef.current
    if (!selected) {
      if (foundations[fi].length > 0) {
        const topCard = foundations[fi][foundations[fi].length - 1]
        setSelected({ source: 'foundation', col: fi, cardIndex: foundations[fi].length - 1, cards: [topCard] })
      }
      return
    }

    if (selected.cards.length !== 1) {
      setSelected(null)
      return
    }

    const card = selected.cards[0]
    if (!canMoveToFoundation(card, foundations[fi])) {
      setSelected(null)
      return
    }

    let newF = foundationsRef.current.map(pile => [...pile])
    let newT = tableau.map(c => [...c])
    let newW = [...waste]

    newF[fi] = [...newF[fi], card]
    if (selected.source === 'tableau') {
      newT[selected.col] = newT[selected.col].slice(0, selected.cardIndex)
      newT = flipTopCards(newT)
    } else if (selected.source === 'waste') {
      newW = newW.slice(0, -1)
    } else if (selected.source === 'foundation') {
      newF[selected.col] = newF[selected.col].slice(0, -1)
    }

    setFoundations(newF)
    setTableau(newT)
    setWaste(newW)
    setMoves(m => m + 1)
    setSelected(null)
  }, [selected, flipTopCards])

  const submitScore = useCallback(async (isWin) => {
    const foundations = foundationsRef.current
    const totalCards = foundations.reduce((sum, pile) => sum + pile.length, 0)
    const baseScore = isWin ? 50 : 10
    const stepBonus = isWin ? Math.max(0, 100 - moves) : 0
    const timeBonus = isWin ? Math.max(0, Math.floor((300 - elapsed) / 10)) : 0
    const score = baseScore + stepBonus + timeBonus
    try {
      const _r = await api.gameScore('klondike', {
        score,
        duration: elapsed,
        timestamp: new Date().toISOString(),
        is_win: isWin,
        moves,
        draw_mode: drawMode,
        stock_resets: stockResets,
      })
      notify(`积分 +${_r.earned_points} · 总分 ${_r.total_points} · 第 ${_r.rank} 名`, 'success')
    } catch (e) {
      notify(e?.message || '成绩上报失败,请检查网络后重试', 'error')
    }
  }, [moves, elapsed, drawMode, stockResets])

  useEffect(() => {
    const foundations = foundationsRef.current
    const totalInFoundation = foundations.reduce((sum, pile) => sum + pile.length, 0)
    if (totalInFoundation === 52 && state === 'playing') {
      setState('won')
      submitScore(true)
    }
  }, [foundations, state])

  const giveUp = useCallback(() => {
    setState('lost')
    submitScore(false)
  }, [submitScore])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const totalInFoundation = foundations.reduce((sum, pile) => sum + pile.length, 0)

  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-school-tint flex flex-col">
        <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
          <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
            <span className="text-base leading-none">‹</span><span>返回</span>
          </button>
          <span className="text-xs text-white/60">经典克朗代克</span>
          <span className="opacity-0 px-3">认输</span>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
            <div className="text-5xl mb-3">🃏</div>
            <h2 className="text-xl font-bold text-school mb-2">经典克朗代克</h2>
            <p className="text-sm text-slate-500 mb-6">最经典的 Solitaire 玩法，翻牌建堆，以花色收集全部 52 张牌</p>
                <div className="flex gap-3 justify-center mb-4">
                  <button onClick={() => { setDifficulty('easy'); setDrawMode(1) }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${difficulty === 'easy' ? 'bg-school text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    简单<div className="text-[10px] font-normal text-slate-400 mt-0.5">每次翻 1 张</div>
                  </button>
                  <button onClick={() => { setDifficulty('hard'); setDrawMode(3) }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${difficulty === 'hard' ? 'bg-school text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    困难<div className="text-[10px] font-normal text-slate-400 mt-0.5">每次翻 3 张</div>
                  </button>
                </div>
                <button onClick={handleStart} disabled={!difficulty}
                  className={`px-8 py-3 rounded-xl text-base font-semibold transition-all shadow-md ${difficulty ? 'bg-school text-white hover:bg-school-dark active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                  {difficulty ? '开始游戏' : '请选择难度'}
                </button>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[70vh] text-school/60">
        <div className="text-center">
          <div className="text-3xl mb-2">🃏</div>
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
            <p>收牌：{totalInFoundation} / 52</p>
            <p>用时：{formatTime(elapsed)}</p>
            <p>步数：{moves}</p>
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
  const renderCard = (card, isSelected) => {
    return <GameCard.Face card={card} className="border-0" />
  }

  const isCardSelected = (source, col, cardIndex) => {
    if (!selected) return false
    if (selected.source !== source || selected.col !== col) return false
    if (source === 'waste' || source === 'foundation') return selected.cardIndex === cardIndex
    return cardIndex >= selected.cardIndex
  }
return (
    <div className="min-h-screen bg-school-tint flex flex-col">
      <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-base leading-none">‹</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">经典克朗代克</span>
        <button onClick={giveUp} className="text-schoolred-dark font-bold hover:opacity-80">
          认输
        </button>
      </header>

      <div className="flex justify-center px-3 py-2">
        <div className="bg-white rounded-xl shadow-sm px-4 py-1.5 flex items-center gap-4 text-xs text-slate-600">
          <span>🃏 {totalInFoundation}/52</span>
          <span className="text-slate-300">|</span>
          <span>⏱ {formatTime(elapsed)}</span>
          <span className="text-slate-300">|</span>
          <span>步 {moves}</span>
          <button onClick={undo} disabled={undoStack.length === 0}
            className={`text-xs px-2 py-0.5 rounded ${undoStack.length > 0 ? 'text-schoolred-dark font-bold hover:opacity-80' : 'text-slate-400'}`}>
            ↩ 撤销
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 select-none">
        {/* Top row: foundations + stock/waste */}
        <div className="flex justify-between mb-2">
          <div className="flex gap-1">
            {foundations.map((pile, fi) => (
              <div
                key={fi}
                className="relative rounded-[5px] border-2 border-dashed border-slate-300 cursor-pointer"
                style={{ width: CARD_W, height: CARD_H }}
                onClick={() => handleFoundationClick(fi)}
              >
                {pile.length > 0 ? (
                  <div
                    className={`absolute inset-0 rounded-[5px] border bg-white border-slate-300 shadow-sm
                      ${isCardSelected('foundation', fi, pile.length - 1) ? 'ring-2 ring-school-mid' : ''}`}
                  >
                    {renderCard(pile[pile.length - 1], false, false)}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs">
                    {SUIT_SYMBOLS[SUITS[fi]]}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            <div
              className="relative rounded-[5px] cursor-pointer"
              style={{ width: CARD_W, height: CARD_H }}
              onClick={handleStockClick}
            >
              {stock.length > 0 ? (
                <div className="absolute inset-0 rounded-[5px] overflow-hidden">
                  <GameCard.Back className="rounded-none" />
                </div>
              ) : (
                <div className="absolute inset-0 rounded-[5px] border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px]">
                  ↻
                </div>
              )}
            </div>

            <div
              className="relative rounded-[5px] cursor-pointer"
              style={{ width: CARD_W, height: CARD_H, marginLeft: 4 }}
              onClick={handleWasteClick}
            >
              {waste.length > 0 ? (
                <div
                  className={`absolute inset-0 rounded-[5px] border bg-white border-slate-300 shadow-sm
                    ${selected && selected.source === 'waste' ? 'ring-2 ring-school-mid' : ''}`}
                >
                  {renderCard(waste[waste.length - 1], false, false)}
                </div>
              ) : (
                <div className="absolute inset-0 rounded-[5px] border-2 border-dashed border-slate-300" />
              )}
            </div>
          </div>
        </div>{/* Tableau */}
        <div className="flex gap-1 justify-center">
          {tableau.map((col, colIdx) => (
            <div
              key={colIdx}
              className="relative"
              style={{ width: CARD_W, minHeight: 120 }}
              onClick={() => {
                if (col.length === 0) handleEmptyTableauClick(colIdx)
              }}
            >
              {col.length === 0 && (
                <div
                  className="absolute top-0 left-0 rounded-[5px] border-2 border-dashed border-slate-300 cursor-pointer"
                  style={{ width: CARD_W, height: CARD_H }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-[10px]">K</div>
                </div>
              )}
              {col.map((card, cardIdx) => {
                const isSelected = isCardSelected('tableau', colIdx, cardIdx)
                const offset = card.faceUp
                  ? FACE_DOWN_OFFSET * Math.min(cardIdx, col.findIndex(c => c.faceUp)) + FACE_UP_OFFSET * (cardIdx - col.findIndex(c => c.faceUp))
                  : cardIdx * FACE_DOWN_OFFSET
                const faceUpStartIdx = col.findIndex(c => c.faceUp)
                const realOffset = cardIdx < faceUpStartIdx
                  ? cardIdx * FACE_DOWN_OFFSET
                  : faceUpStartIdx * FACE_DOWN_OFFSET + (cardIdx - faceUpStartIdx) * FACE_UP_OFFSET
                return (
                  <div
                    key={card.id}
                    className={`absolute rounded-[5px] border cursor-pointer select-none
                      transition-shadow duration-100
                      ${isSelected ? 'ring-2 ring-school-mid shadow-lg' : ''}
                      ${card.faceUp
                        ? 'bg-white border-slate-300 shadow-sm'
                        : 'border-slate-300 overflow-hidden'
                      }`}
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      top: realOffset,
                      left: 0,
                      zIndex: cardIdx + 1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (card.faceUp) handleTableauCardClick(colIdx, cardIdx)
                    }}
                  >
                    {!card.faceUp ? <GameCard.Back className={`rounded-none ${flippingIds.current.has(card.id) ? 'card-reveal' : ''}`} /> : renderCard(card, isSelected)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowRules(true)}
        className="fixed bottom-20 right-4 z-30 bg-school text-white rounded-full shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 hover:bg-school-dark active:scale-95 transition-all"
      >
        📖 规则
      </button>

      {showRules && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={closeRules}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-school mb-3">🃏 经典克朗代克规则</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>目标：</strong>将 52 张牌按花色从 A 到 K 全部收集到 4 个基础牌堆。</p>
              <p><strong>操作：</strong>点击选中牌，再点击目标位置移动。双击可快速送入基础牌堆。</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>牌列区：降序排列，颜色交替（红黑），可移动连续牌组</li>
                <li>基础牌堆：同花色升序，从 A 开始</li>
                <li>空列可放任意牌或牌组</li>
                <li>点击手牌堆翻牌到弃牌堆</li>
                <li>手牌堆用尽后点击可重置</li>
              </ul>
              <p><strong>计分：</strong>胜利基础 50 分 + 步数奖励 + 时间奖励。认输 10 分。</p>
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
