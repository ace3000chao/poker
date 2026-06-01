import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import GameCard from '../components/GameCard'

const SUITS = ['S', 'H', 'C', 'D']
const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦' }
const SUIT_COLORS = { S: 'text-gray-900', H: 'text-red-600', C: 'text-gray-900', D: 'text-red-600' }
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const CARD_W = 52
const CARD_H = 72
const CASCADE_OFFSET = 20

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
    for (let r = 0; r < 13; r++) {
      deck.push({ suit, rank: r, id: `${suit}_${r}` })
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
  const columns = Array.from({ length: 8 }, () => [])
  shuffled.forEach((card, i) => {
    columns[i % 8].push(card)
  })
  return { columns, freecells: [null, null, null, null], foundations: [null, null, null, null] }
}

function isRed(suit) { return suit === 'H' || suit === 'D' }

function canPlaceOnCascade(card, target) {
  if (!target) return true
  return isRed(card.suit) !== isRed(target.suit) && card.rank === target.rank - 1
}

function canPlaceOnFoundation(card, foundationTop) {
  if (!foundationTop) return card.rank === 0
  return card.suit === foundationTop.suit && card.rank === foundationTop.rank + 1
}

function getMaxMovable(freeCells, emptyCascades) {
  return Math.pow(2, freeCells + emptyCascades * 2)
}

function findSuitFoundationIndex(suit) {
  return SUITS.indexOf(suit)
}

function autoMoveToFoundations(cols, fc, fnd) {
  let moved = true
  let anyMoved = false
  while (moved) {
    moved = false
    for (let ci = 0; ci < cols.length; ci++) {
      if (cols[ci].length === 0) continue
      const card = cols[ci][cols[ci].length - 1]
      const fi = findSuitFoundationIndex(card.suit)
      if (canPlaceOnFoundation(card, fnd[fi])) {
        fnd[fi] = card
        cols[ci].pop()
        moved = true
        anyMoved = true
      }
    }
    for (let i = 0; i < 4; i++) {
      if (!fc[i]) continue
      const fi = findSuitFoundationIndex(fc[i].suit)
      if (canPlaceOnFoundation(fc[i], fnd[fi])) {
        fnd[fi] = fc[i]
        fc[i] = null
        moved = true
        anyMoved = true
      }
    }
  }
  return anyMoved
}

function isSafeAutoMove(card, fnd) {
  if (card.rank === 0) return true
  const fi = findSuitFoundationIndex(card.suit)
  const top = fnd[fi]
  if (!canPlaceOnFoundation(card, top)) return false
  const oppositeColor = isRed(card.suit) ? ['S', 'C'] : ['H', 'D']
  for (const s of oppositeColor) {
    const si = findSuitFoundationIndex(s)
    const oTop = fnd[si]
    if (!oTop || oTop.rank < card.rank - 1) return false
  }
  return true
}

export default function FreeCell() {
  const navigate = useNavigate()
  const [state, setState] = useState('ready')
  const [error, setError] = useState(null)
  const [columns, setColumns] = useState([])
  const [freeCells, setFreeCells] = useState([null, null, null, null])
  const [foundations, setFoundations] = useState([null, null, null, null])
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [gameSessionId, setGameSessionId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [selected, setSelected] = useState(null)
  const [showRules, setShowRules] = useState(() => !localStorage.getItem('freecell_rules_seen'))
  const [freecellUsage, setFreecellUsage] = useState(0)
  const [totalFreecellOps, setTotalFreecellOps] = useState(0)
  const [undoStack, setUndoStack] = useState([])
  const timerRef = useRef(null)
  const toastTimer = useRef(null)
  const [toast, setToast] = useState(null)
  const columnsRef = useRef(columns)
  const freecellsRef = useRef(freeCells)
  const foundationsRef = useRef(foundations)

  const closeRules = useCallback(() => {
    setShowRules(false)
    localStorage.setItem('freecell_rules_seen', '1')
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev, {
      columns: columnsRef.current.map(col => col.map(c => ({...c}))),
      freeCells: [...freecellsRef.current],
      foundations: foundationsRef.current.map(f => f ? {...f} : null),
      moves,
      elapsed,
    }])
  }, [moves, elapsed])

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setColumns(last.columns)
    setFreeCells(last.freeCells)
    setFoundations(last.foundations)
    setMoves(last.moves)
    setElapsed(last.elapsed)
    setUndoStack(prev => prev.slice(0, -1))
    setSelected(null)
  }, [undoStack])

const handleStart = useCallback(() => {
    setState('loading')
    api.gamePlay('freecell').then(data => {
      const rng = mulberry32(data.seed)
      const deck = createDeck()
      const shuffled = shuffle(deck, rng)
      const { columns: cols, freecells: fc, foundations: f } = dealInitial(shuffled)
      setColumns(cols)
      setFreeCells(fc)
      setFoundations(f)
      setGameSessionId(data.game_session_id)
      setStartedAt(data.started_at)
      setState('playing')
    }).catch(err => {
      setError(err.message)
      setState('error')
    })
  }, [])


  useEffect(() => { columnsRef.current = columns }, [columns])
  useEffect(() => { freecellsRef.current = freeCells }, [freeCells])
  useEffect(() => { foundationsRef.current = foundations }, [foundations])

  useEffect(() => {
    if (state === 'playing' && !showRules) {
      timerRef.current = setInterval(() => {
        setElapsed(e => e + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [state, showRules])

  const checkWin = useCallback((fnd) => {
    return fnd.every(f => f && f.rank === 12)
  }, [])

  const doAutoMove = useCallback((newCols, newFc, newFnd) => {
    let moved = true
    while (moved) {
      moved = false
      for (let ci = 0; ci < newCols.length; ci++) {
        if (newCols[ci].length === 0) continue
        const card = newCols[ci][newCols[ci].length - 1]
        if (isSafeAutoMove(card, newFnd)) {
          const fi = findSuitFoundationIndex(card.suit)
          newFnd[fi] = card
          newCols[ci].pop()
          moved = true
        }
      }
    }
  }, [])

  const handleDoubleClick = useCallback((card, source) => {
    const columns = columnsRef.current
    const freeCells = freecellsRef.current
    const foundations = foundationsRef.current
    const fi = findSuitFoundationIndex(card.suit)
    const newCols = columns.map(c => [...c])
    const newFc = [...freeCells]
    const newFnd = foundations.map(f => f ? { ...f } : null)

    if (source.type === 'cascade') {
      const colIdx = source.col
      const col = newCols[colIdx]
      if (col[col.length - 1] !== card) return
      if (!canPlaceOnFoundation(card, newFnd[fi])) return
      newFnd[fi] = card
      col.pop()
    } else if (source.type === 'freecell') {
      if (!canPlaceOnFoundation(card, newFnd[fi])) return
      newFnd[fi] = card
      newFc[source.idx] = null
    }

    doAutoMove(newCols, newFc, newFnd)
    pushUndo()
    setColumns(newCols)
    setFreeCells(newFc)
    setFoundations(newFnd)
    setMoves(m => m + 1)
  }, [doAutoMove])

  const handleClick = useCallback((target) => {
    if (state !== 'playing') return
    const columns = columnsRef.current
    const freeCells = freecellsRef.current

    if (selected === null) {
      if (target.type === 'cascade' && target.cardIdx !== undefined) {
        const col = columns[target.col]
        const card = col[target.cardIdx]
        if (!card) return
        const emptyCascades = columns.filter((c, i) => c.length === 0 && i !== target.col).length
        const usedCells = freeCells.filter(c => c !== null).length
        const fc = 4 - usedCells
        const maxMove = getMaxMovable(fc, emptyCascades)
        const groupLen = col.length - target.cardIdx
        if (groupLen > maxMove) return
        let valid = true
        for (let i = target.cardIdx + 1; i < col.length; i++) {
          const prev = col[i - 1]
          const cur = col[i]
          if (isRed(cur.suit) === isRed(prev.suit) || cur.rank !== prev.rank - 1) {
            valid = false
            break
          }
        }
        if (!valid) return
        setSelected(target)
      } else if (target.type === 'freecell') {
        if (freeCells[target.idx]) {
          setSelected(target)
        } else {
          showToast('空闲位不足')
        }
      } else if (target.type === 'foundation') {
        return
      }
      return
    }

    const newCols = columns.map(c => [...c])
    const newFc = [...freeCells]
    const newFnd = foundations.map(f => f ? { ...f } : null)
    let sourceCard
    const sourceType = selected.type

    if (selected.type === 'cascade') {
      sourceCard = newCols[selected.col][selected.cardIdx]
    } else if (selected.type === 'freecell') {
      sourceCard = newFc[selected.idx]
    }

    if (!sourceCard) { setSelected(null); return }

    if (target.type === selected.type) {
      if (target.type === 'cascade' && target.col === selected.col) { setSelected(null); return }
      if (target.type === 'freecell' && target.idx === selected.idx) { setSelected(null); return }
    }

    if (target.type === 'foundation') {
      const fi = findSuitFoundationIndex(sourceCard.suit)
      if (sourceType === 'cascade') {
        const col = newCols[selected.col]
        if (col[col.length - 1] !== sourceCard) { setSelected(null); return }
        if (!canPlaceOnFoundation(sourceCard, newFnd[fi])) { showToast('不能放入此基础牌堆'); setSelected(null); return }
        newFnd[fi] = sourceCard
        col.pop()
      } else if (sourceType === 'freecell') {
        if (!canPlaceOnFoundation(sourceCard, newFnd[fi])) { showToast('不能放入此基础牌堆'); setSelected(null); return }
        newFnd[fi] = sourceCard
        newFc[selected.idx] = null
      }
      doAutoMove(newCols, newFc, newFnd)
      pushUndo()
      setColumns(newCols)
      setFreeCells(newFc)
      setFoundations(newFnd)
      setMoves(m => m + 1)
      setSelected(null)
      return
    }

    if (target.type === 'freecell') {
      if (newFc[target.idx] !== null) { setSelected(null); return }
      if (sourceType === 'cascade') {
        const col = newCols[selected.col]
        if (col[col.length - 1] !== sourceCard) { setSelected(null); return }
        newFc[target.idx] = sourceCard
        col.pop()
        setFreecellUsage(u => u + 1)
        setTotalFreecellOps(t => t + 1)
      } else if (sourceType === 'freecell') {
        newFc[target.idx] = sourceCard
        newFc[selected.idx] = null
      }
      doAutoMove(newCols, newFc, newFnd)
      pushUndo()
      setColumns(newCols)
      setFreeCells(newFc)
      setFoundations(newFnd)
      setMoves(m => m + 1)
      setSelected(null)
      return
    }

    if (target.type === 'cascade') {
      const targetCol = newCols[target.col]
      const targetTop = targetCol.length > 0 ? targetCol[targetCol.length - 1] : null

      if (sourceType === 'cascade') {
        const srcCol = newCols[selected.col]
        const group = srcCol.slice(selected.cardIdx)
        const groupLen = group.length
        const emptyTarget = targetCol.length === 0
        const emptyCascades = newCols.filter((c, i) => c.length === 0 && i !== selected.col && i !== target.col).length
        const usedCells = 4 - newFc.filter(c => c === null).length
        const fc = 4 - usedCells

        if (emptyTarget) {
          const maxMove = getMaxMovable(fc, emptyCascades)
          if (groupLen > maxMove) { setSelected(null); return }
          if (groupLen === 0) { setSelected(null); return }
        } else {
          if (!canPlaceOnCascade(group[0], targetTop)) { setSelected(null); return }
          if (groupLen > 1) {
            const maxMove = getMaxMovable(fc, emptyCascades)
            if (groupLen > maxMove) { setSelected(null); return }
          }
        }

        newCols[selected.col] = srcCol.slice(0, selected.cardIdx)
        newCols[target.col] = [...targetCol, ...group]
      } else if (sourceType === 'freecell') {
        if (targetCol.length === 0) {
          newCols[target.col] = [sourceCard]
        } else {
          if (!canPlaceOnCascade(sourceCard, targetTop)) { setSelected(null); return }
          newCols[target.col] = [...targetCol, sourceCard]
        }
        newFc[selected.idx] = null
        setTotalFreecellOps(t => t + 1)
      }

      doAutoMove(newCols, newFc, newFnd)
      pushUndo()
      setColumns(newCols)
      setFreeCells(newFc)
      setFoundations(newFnd)
      setMoves(m => m + 1)
      setSelected(null)
      return
    }

    setSelected(null)
  }, [state, selected, doAutoMove])

  const submitScore = useCallback(async (isWin) => {
    const baseScore = isWin ? 60 : 10
    const moveBonus = isWin ? Math.max(0, 200 - moves) : 0
    const timeBonus = isWin ? Math.max(0, 600 - elapsed) : 0
    const score = baseScore + moveBonus + timeBonus
    const fcAvg = totalFreecellOps > 0 ? freecellUsage / totalFreecellOps : 0
    try {
      await api.gameScore('freecell', {
        score,
        duration: elapsed,
        timestamp: new Date().toISOString(),
        is_win: isWin,
        moves,
        freecell_usage_avg: fcAvg,
      })
    } catch (e) {
      console.error('Score submission failed:', e)
    }
  }, [moves, elapsed, freecellUsage, totalFreecellOps])

  useEffect(() => {
    const foundations = foundationsRef.current
    if (state === 'playing' && checkWin(foundations)) {
      setState('won')
      submitScore(true)
    }
  }, [foundations, state, checkWin, submitScore])

  useEffect(() => {
    if (state !== 'playing') return
    const columns = columnsRef.current
    const freeCells = freecellsRef.current
    const foundations = foundationsRef.current
    const usedCells = freeCells.filter(c => c !== null).length
    if (usedCells > 0) return
    // Check if any cascade move is possible
    for (let ci = 0; ci < 8; ci++) {
      if (columns[ci].length === 0) continue
      const card = columns[ci][columns[ci].length - 1]
      const fi = findSuitFoundationIndex(card.suit)
      if (canPlaceOnFoundation(card, foundations[fi])) return
      for (let cj = 0; cj < 8; cj++) {
        if (ci === cj) continue
        const target = columns[cj]
        if (target.length === 0) return
        if (canPlaceOnCascade(card, target[target.length - 1])) return
      }
    }
    showToast('已无可用操作，请认输')
  }, [foundations, state, showToast])

  const giveUp = useCallback(() => {
    setState('lost')
    submitScore(false)
  }, [submitScore])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const foundationCount = foundations.filter(f => f !== null).length

  const isSelected = (type, idx, col, cardIdx) => {
    if (!selected) return false
    if (selected.type === 'freecell' && type === 'freecell') return selected.idx === idx
    if (selected.type === 'cascade' && type === 'cascade') {
      return selected.col === col && cardIdx >= selected.cardIdx
    }
    return false
  }

  const renderCard = (card, highlight = false) => (
    <GameCard.Face card={card} className={highlight ? 'ring-2 ring-school-mid shadow-lg' : ''} />
  )

  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-school-tint flex flex-col">
        <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
          <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
            <span className="text-base leading-none">‹</span><span>返回</span>
          </button>
          <span className="text-xs text-white/60">空当接龙</span>
          <button className="opacity-0 px-3">认输</button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
            <div className="text-5xl mb-3">🗂</div>
            <h2 className="text-xl font-bold text-school mb-2">空当接龙</h2>
            <p className="text-sm text-slate-500 mb-6">全明牌纯策略，利用 4 个空闲位巧妙完成 A→K 收集</p>
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
    const foundationComplete = foundations.filter(f => f && f.rank === 12).length
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
          <div className="text-5xl mb-3">{state === 'won' ? '🎉' : '😔'}</div>
          <h2 className="text-xl font-bold text-school mb-2">
            {state === 'won' ? '恭喜通关！' : '游戏结束'}
          </h2>
          <div className="space-y-1 text-sm text-slate-600 mb-4">
            <p>完成花色：{foundationComplete} / 4</p>
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

  return (
    <div className="min-h-screen bg-school-tint flex flex-col">
      <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-base leading-none">‹</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">空当接龙</span>
        <button onClick={giveUp} className="text-schoolred-dark font-bold hover:opacity-80">
          认输
        </button>
      </header>

      <div className="flex justify-center px-3 py-2">
        <div className="bg-white rounded-xl shadow-sm px-4 py-1.5 flex items-center gap-4 text-xs text-slate-600">
          <span>🃏 {foundationCount}/52</span>
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

      {/* Free cells + Foundations */}
      <div className="flex justify-between px-2 py-2 bg-school-tint">
        <div className="flex gap-1">
          {freeCells.map((card, i) => (
            <div
              key={`fc-${i}`}
              className={`w-[46px] h-[64px] rounded-[4px] border cursor-pointer
                ${card
                  ? isSelected('freecell', i) ? 'bg-white border-school-mid shadow-md' : 'bg-white border-slate-300 shadow-sm'
                  : 'border-2 border-dashed border-slate-300 bg-white/50'
                }`}
              onClick={() => {
                if (card) {
                  if (selected) {
                    handleClick({ type: 'freecell', idx: i })
                  } else {
                    setSelected({ type: 'freecell', idx: i })
                  }
                } else if (selected) {
                  handleClick({ type: 'freecell', idx: i })
                }
              }}
              onDoubleClick={() => card && handleDoubleClick(card, { type: 'freecell', idx: i })}
            >
              {card && renderCard(card, isSelected('freecell', i))}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {SUITS.map((suit, i) => {
            const card = foundations[i]
            return (
              <div
                key={`fnd-${suit}`}
                className={`w-[46px] h-[64px] rounded-[4px] border cursor-pointer
                  ${card
                    ? 'bg-white border-slate-300 shadow-sm'
                    : 'border-2 border-dashed border-slate-300 bg-white/50'
                  }`}
                onClick={() => selected && handleClick({ type: 'foundation', idx: i })}
              >
                {card && renderCard(card)}
                {!card && (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className={`text-xl ${SUIT_COLORS[suit]} opacity-30`}>{SUIT_SYMBOLS[suit]}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cascade columns */}
      <div className="flex-1 overflow-y-auto px-2 py-1 select-none">
        <div className="flex gap-1 justify-center min-w-max">
          {columns.map((col, colIdx) => (
            <div
              key={`col-${colIdx}`}
              className="relative"
              style={{ width: CARD_W, minHeight: 280 }}
              onClick={() => {
                if (col.length === 0 && selected) {
                  handleClick({ type: 'cascade', col: colIdx })
                } else if (col.length > 0 && selected) {
                  handleClick({ type: 'cascade', col: colIdx, cardIdx: col.length - 1 })
                }
              }}
            >
              {col.length === 0 && (
                <div
                  className="absolute top-0 left-0 rounded-[4px] border-2 border-dashed border-slate-200"
                  style={{ width: CARD_W, height: CARD_H }}
                />
              )}
              {col.map((card, cardIdx) => {
                const hl = isSelected('cascade', undefined, colIdx, cardIdx)
                return (
                  <div
                    key={card.id}
                    className={`absolute rounded-[4px] border cursor-pointer transition-shadow duration-100
                      ${hl ? 'ring-2 ring-school-mid shadow-lg' : 'border-slate-300 shadow-sm'}
                      bg-white`}
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      top: cardIdx * CASCADE_OFFSET,
                      left: 0,
                      zIndex: cardIdx + 1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (selected) {
                        handleClick({ type: 'cascade', col: colIdx, cardIdx })
                      } else {
                        setSelected({ type: 'cascade', col: colIdx, cardIdx })
                      }
                    }}
                    onDoubleClick={() => {
                      if (cardIdx === col.length - 1) {
                        handleDoubleClick(card, { type: 'cascade', col: colIdx })
                      }
                    }}
                  >
                    {renderCard(card, hl)}
                  </div>
                )
              })}
            </div>
          ))}
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
            <h3 className="font-bold text-lg text-school mb-3">🃏 空当接龙规则</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>目标：</strong>将52张牌按花色从A到K全部移到右上角的回收区。</p>
              <p><strong>操作：</strong>点击选中牌，再点击目标位置移动；双击自动收入回收区。</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>各列牌必须红黑交替、数字递减排列</li>
                <li>空列可以放任意牌</li>
                <li>4个空闲位各可暂存1张牌</li>
                <li>一次可移动的牌数 = 2^(空闲位数+空列数×2)</li>
                <li>回收区按花色A→K升序叠放</li>
              </ul>
              <p><strong>计分：</strong>胜局基础60分 + 步数奖励(max 200-步数) + 时间奖励(max 600-秒数)。</p>
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