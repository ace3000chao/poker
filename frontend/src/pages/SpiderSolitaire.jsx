import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import GameCard from '../components/GameCard'
import { showToast as notify } from '../components/Toast'

const SUIT_SYMBOLS = { S: '?', H: '?', C: '?', D: '?' }
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const CARD_W = 52
const CARD_H = 72
const FACE_DOWN_OFFSET = 16
const FACE_UP_OFFSET = 24
const COL_GAP = 2
const PAD_H = 12

function mulberry32(seed) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createDeck(suit, copies) {
  const deck = []
  for (let c = 0; c < copies; c++) {
    for (let r = 0; r < 13; r++) {
      deck.push({ suit, rank: r, id: `${suit}_${r}_${c}` })
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
  const columns = Array.from({ length: 10 }, () => [])
  let idx = 0
  for (let col = 0; col < 10; col++) {
    const count = col < 4 ? 6 : 5
    for (let i = 0; i < count; i++) {
      const faceUp = i === count - 1
      columns[col].push({ ...shuffled[idx], faceUp })
      idx++
    }
  }
  const stock = shuffled.slice(idx)
  return { columns, stock }
}

function getCardValue(rank) { return rank + 1 }

function canDrop(card, target) {
  if (!target) return true
  return getCardValue(target.rank) === getCardValue(card.rank) + 1
}

function getDraggableGroup(column, cardIndex) {
  const group = []
  for (let i = cardIndex; i < column.length; i++) {
    const card = column[i]
    if (!card.faceUp) return null
    if (group.length > 0) {
      const prev = group[group.length - 1]
      if (card.suit !== prev.suit || getCardValue(card.rank) !== getCardValue(prev.rank) - 1) {
        return group
      }
    }
    group.push(card)
  }
  return group
}

function isValidSequence(group) {
  if (group.length <= 1) return true
  for (let i = 1; i < group.length; i++) {
    const prev = group[i - 1], cur = group[i]
    if (cur.suit !== prev.suit || getCardValue(cur.rank) !== getCardValue(prev.rank) - 1) {
      return false
    }
  }
  return true
}

function hasAnyValidMove(columns, stock) {
  if (stock.length >= 10) return true
  for (let src = 0; src < columns.length; src++) {
    const srcCol = columns[src]
    if (srcCol.length === 0) continue
    const group = getDraggableGroup(srcCol, srcCol.length - 1)
    if (!group) continue
    for (let dst = 0; dst < columns.length; dst++) {
      if (dst === src) continue
      const dstCol = columns[dst]
      if (dstCol.length === 0) return true
      if (canDrop(group[0], dstCol[dstCol.length - 1])) return true
    }
  }
  return false
}

function checkCompleteSequence(column) {
  if (column.length < 13) return null
  const last13 = column.slice(-13)
  for (let i = 1; i < 13; i++) {
    const prev = last13[i - 1], cur = last13[i]
    if (!cur.faceUp) return null
    if (cur.suit !== prev.suit) return null
    if (getCardValue(cur.rank) !== getCardValue(prev.rank) - 1) return null
  }
  if (last13[0].rank !== 12 || last13[12].rank !== 0) return null
  return last13
}

function getCompleteableColumns(columns) {
  const result = []
  for (let i = 0; i < columns.length; i++) {
    const seq = checkCompleteSequence(columns[i])
    if (seq) result.push(i)
  }
  return result
}

function calcCardTop(col, cardIdx) {
  const faceUpStart = col.findIndex(c => c.faceUp)
  if (faceUpStart === -1) return cardIdx * FACE_DOWN_OFFSET
  if (cardIdx < faceUpStart) return cardIdx * FACE_DOWN_OFFSET
  return faceUpStart * FACE_DOWN_OFFSET + (cardIdx - faceUpStart) * FACE_UP_OFFSET
}

function calcColHeight(col) {
  if (col.length === 0) return 72
  return calcCardTop(col, col.length - 1) + CARD_H
}

export default function SpiderSolitaire() {
  const navigate = useNavigate()
  const [state, setState] = useState('ready')
  const [error, setError] = useState(null)
  const [columns, setColumns] = useState([])
  const [stock, setStock] = useState([])
  const [completed, setCompleted] = useState(0)
  const [moves, setMoves] = useState(0)
  const [undoStack, setUndoStack] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const [gameSessionId, setGameSessionId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const [showRules, setShowRules] = useState(() => !localStorage.getItem('spider_rules_seen'))
  const [difficulty, setDifficulty] = useState(null)
  const [flippingIds, setFlippingIds] = useState(new Set())
  const timerRef = useRef(null)
  const toastTimer = useRef(null)
  const flipTimerRef = useRef(null)
  const columnsRef = useRef(columns)
  const stockRef = useRef(stock)

  useEffect(() => { columnsRef.current = columns }, [columns])
  useEffect(() => { stockRef.current = stock }, [stock])

  const closeRules = useCallback(() => {
    setShowRules(false)
    localStorage.setItem('spider_rules_seen', '1')
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  const handleStart = useCallback(() => {
    if (!difficulty) return
    setState('loading')
    api.gamePlay('spider_solitaire').then(data => {
      const rng = mulberry32(data.seed)
      const deck = difficulty === 'easy'
        ? createDeck('S', 8)
        : [...createDeck('S', 2), ...createDeck('H', 2), ...createDeck('C', 2), ...createDeck('D', 2)]
      const shuffled = shuffle(deck, rng)
      const { columns: cols, stock: st } = dealInitial(shuffled)
      setColumns(cols)
      setStock(st)
      setGameSessionId(data.game_session_id)
      setStartedAt(data.started_at)
      setState('playing')
    }).catch(err => {
      setError(err.message)
      setState('error')
    })
  }, [difficulty])

  const triggerFlip = useCallback((cardId) => {
    setFlippingIds(prev => {
      const next = new Set(prev)
      next.add(cardId)
      return next
    })
    clearTimeout(flipTimerRef.current)
    flipTimerRef.current = setTimeout(() => {
      setFlippingIds(prev => {
        const next = new Set(prev)
        next.delete(cardId)
        return next
      })
    }, 600)
  }, [])

  useEffect(() => {
    if (state === 'playing' && !showRules) {
      timerRef.current = setInterval(() => {
        setElapsed(e => e + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [state, showRules])


  const moveCards = useCallback((srcCol, srcIdx, dstCol) => {
    const cols = columnsRef.current
    const sourceCol = cols[srcCol]
    const group = sourceCol.slice(srcIdx)
    const newCols = cols.map((c, i) => {
      if (i === srcCol) return c.slice(0, srcIdx)
      if (i === dstCol) return [...c, ...group]
      return c
    })
    const uncovered = srcIdx > 0 && newCols[srcCol].length > 0 &&
      !newCols[srcCol][newCols[srcCol].length - 1].faceUp
    if (uncovered) {
      const card = newCols[srcCol][newCols[srcCol].length - 1]
      card.faceUp = true
      triggerFlip(card.id)
    }
    const seq = checkCompleteSequence(newCols[dstCol])
    if (seq) {
      newCols[dstCol] = newCols[dstCol].slice(0, -13)
      setCompleted(c => c + 1)
      if (newCols[dstCol].length > 0) {
        const last = newCols[dstCol][newCols[dstCol].length - 1]
        if (!last.faceUp) {
          last.faceUp = true
          triggerFlip(last.id)
        }
      }
    }
    setUndoStack(prev => {
      const next = [...prev, { columns: cols, stock: stockRef.current, moves, completed }]
      return next.length > 50 ? next.slice(-50) : next
    })
    setColumns(newCols)
    setMoves(m => m + 1)
    setSelected(null)
  }, [moves, completed, triggerFlip])

  const selectCard = useCallback((colIdx, cardIdx) => {
    const col = columnsRef.current[colIdx]
    const group = getDraggableGroup(col, cardIdx)
    if (group) {
      setSelected({ col: colIdx, idx: cardIdx })
    }
  }, [])

  const tryMove = useCallback((targetColIdx, targetCardIdx) => {
    if (!selected) return
    const cols = columnsRef.current
    const srcCol = selected.col
    const srcIdx = selected.idx

    if (srcCol === targetColIdx) {
      // Same column: re-select or deselect
      if (srcIdx === targetCardIdx) {
        setSelected(null)
      } else {
        const group = getDraggableGroup(cols[targetColIdx], targetCardIdx)
        if (group) setSelected({ col: targetColIdx, idx: targetCardIdx })
        else setSelected(null)
      }
      return
    }

    // Different column: try to move
    const group = cols[srcCol].slice(srcIdx)
    const targetCol = cols[targetColIdx]
    const targetBottom = targetCol[targetCol.length - 1]
    if (isValidSequence(group) && canDrop(group[0], targetBottom)) {
      moveCards(srcCol, srcIdx, targetColIdx)
    } else {
      showToast('该序列不能放置')
      setSelected(null)
    }
  }, [selected, moveCards, showToast])

  const handleCardClick = useCallback((colIdx, cardIdx) => {
    const col = columnsRef.current[colIdx]
    if (!col[cardIdx].faceUp) return

    if (selected) {
      tryMove(colIdx, cardIdx)
    } else {
      selectCard(colIdx, cardIdx)
    }
  }, [selected, selectCard, tryMove])


  const handleEmptyColumnClick = useCallback((colIdx) => {
    if (!selected) return
    if (selected.col === colIdx) {
      setSelected(null)
      return
    }
    const cols = columnsRef.current
    const group = cols[selected.col].slice(selected.idx)
    if (isValidSequence(group)) {
      moveCards(selected.col, selected.idx, colIdx)
    } else {
      showToast('该序列不能放置')
      setSelected(null)
    }
  }, [selected, moveCards, showToast])

  const handleColumnAreaClick = useCallback((colIdx, col) => {
    if (!selected) return
    if (selected.col === colIdx) {
      setSelected(null)
      return
    }
    const cols = columnsRef.current
    const group = cols[selected.col].slice(selected.idx)
    const targetBottom = col.length > 0 ? col[col.length - 1] : null
    if (isValidSequence(group) && canDrop(group[0], targetBottom)) {
      moveCards(selected.col, selected.idx, colIdx)
    } else {
      showToast('该序列不能放置')
      setSelected(null)
    }
  }, [selected, moveCards, showToast])

  const dealStock = useCallback(() => {
    const st = stockRef.current
    if (st.length < 10) return
    const cols = columnsRef.current
    const deal = st.slice(0, 10)
    const remaining = st.slice(10)
    const newCols = cols.map((col, i) => [...col, { ...deal[i], faceUp: true }])
    setUndoStack(prev => {
      const next = [...prev, { columns: cols, stock: st, moves, completed }]
      return next.length > 50 ? next.slice(-50) : next
    })
    setColumns(newCols)
    setStock(remaining)
    setMoves(m => m + 1)
    setSelected(null)
  }, [moves, completed])

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setColumns(last.columns)
    setStock(last.stock)
    setMoves(last.moves)
    setCompleted(last.completed)
    setUndoStack(prev => prev.slice(0, -1))
    setSelected(null)
  }, [undoStack])

  const submitScore = useCallback(async (isWin) => {
    const score = completed * 100 + Math.max(0, 600 - elapsed) * 2
    try {
      const _r = await api.gameScore('spider_solitaire', {
        score,
        duration: elapsed,
        timestamp: new Date().toISOString(),
        is_win: isWin,
        completed_sequences: completed,
        moves,
      })
      notify(`积分 +${_r.earned_points} · 总分 ${_r.total_points} · 第 ${_r.rank} 名`, 'success')
    } catch (e) {
      notify(e?.message || '成绩上报失败,请检查网络后重试', 'error')
    }
  }, [completed, elapsed, moves])

  useEffect(() => {
    const completeable = getCompleteableColumns(columns)
    if (completeable.length > 0 && completed < 8) {
      const timer = setTimeout(() => {
        const seq = checkCompleteSequence(columns[completeable[0]])
        if (seq) {
          const newCols = columns.map((col, i) => {
            if (i === completeable[0]) return col.slice(0, -13)
            return col
          })
          if (newCols[completeable[0]].length > 0) {
            const last = newCols[completeable[0]][newCols[completeable[0]].length - 1]
            if (!last.faceUp) {
              last.faceUp = true
              triggerFlip(last.id)
            }
          }
          setColumns(newCols)
          setCompleted(c => c + 1)
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [columns, completed, triggerFlip])

  const winGoal = difficulty === 'easy' ? 3 : 8

  useEffect(() => {
    if (completed >= winGoal) {
      setState('won')
      submitScore(true)
    }
  }, [completed, submitScore, winGoal])

  useEffect(() => {
    if (state !== 'playing' || completed >= winGoal) return
    const cols = columnsRef.current
    const st = stockRef.current
    if (!hasAnyValidMove(cols, st)) {
      const msg = st.length < 10
        ? '剩余发牌不足，建议认输'
        : '当前无有效移动，请发牌或认输'
      showToast(msg)
    }
  }, [columns, stock, state, completed, showToast])

  const giveUp = useCallback(() => {
    setState('lost')
    submitScore(false)
  }, [submitScore])

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
            <span className="text-base leading-none">&#8249;</span>
            <span>返回</span>
          </button>
          <span className="text-xs text-white/60">蜘蛛纸牌</span>
          <span className="opacity-0 px-3">认输</span>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
            <div className="text-5xl mb-3">🕷</div>
            <h2 className="text-xl font-bold text-school mb-2">蜘蛛纸牌</h2>
                <div className="flex gap-3 justify-center mb-5">
                  <button
                    onClick={() => setDifficulty('easy')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${difficulty === 'easy' ? 'border-green-500 bg-green-50 text-green-700 shadow-md' : 'border-slate-200 text-slate-500 hover:border-green-300'}`}
                  >
                    <div className="text-lg mb-0.5">{'\u{1F7E2}'}</div>
                    <div>简单</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">1 花色</div>
                  </button>
                  <button
                    onClick={() => setDifficulty('hard')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${difficulty === 'hard' ? 'border-red-500 bg-red-50 text-red-700 shadow-md' : 'border-slate-200 text-slate-500 hover:border-red-300'}`}
                  >
                    <div className="text-lg mb-0.5">{'\u{1F534}'}</div>
                    <div>困难</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">4 花色</div>
                  </button>
                </div>
                <button
                  onClick={handleStart}
                  disabled={!difficulty}
                  className={`px-8 py-3 rounded-xl text-base font-semibold transition-all shadow-md ${difficulty ? 'bg-school text-white hover:bg-school-dark active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
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
          <div className="text-3xl mb-2">🕷</div>
          <div>发牌中...</div>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-school-tint flex flex-col">
      <header className="bg-school text-white px-3 py-1.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-base leading-none">&#8249;</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">蜘蛛纸牌</span>
        <button onClick={giveUp} className="text-schoolred-dark font-bold hover:opacity-80">
          认输
        </button>
      </header>

      <div className="flex justify-center px-3 py-2">
        <div className="bg-white rounded-xl shadow-sm px-4 py-1.5 flex items-center gap-4 text-xs text-slate-600">
          <span>🕷 {completed}/{winGoal}</span>
          <span className="text-slate-300">|</span>
          <span>⏱ {formatTime(elapsed)}</span>
          <span className="text-slate-300">|</span>
          <span>步 {moves}</span>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className={`text-xs px-2 py-0.5 rounded ${undoStack.length > 0 ? 'text-schoolred-dark font-bold hover:opacity-80' : 'text-slate-400'}`}
          >
            ↩ 撤销
          </button>
          <button
            onClick={dealStock}
            disabled={stock.length < 10}
            className={`text-xs px-2 py-0.5 rounded ${stock.length >= 10 ? 'bg-amber-400 text-white font-bold hover:bg-amber-500' : 'bg-slate-200 text-slate-400'}`}
          >
            发牌 {stock.length}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-2" style={{ minHeight: 0 }}>
        <div className="relative mx-auto" style={{ width: 10 * (CARD_W + COL_GAP) + COL_GAP }}>
          {columns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="absolute top-0"
              style={{ left: colIdx * (CARD_W + COL_GAP) + COL_GAP, width: CARD_W }}
            >
              <div
                className="relative cursor-pointer"
                style={{ height: calcColHeight(col) }}
                onClick={() => {
                  if (col.length === 0) handleEmptyColumnClick(colIdx)
                  else handleColumnAreaClick(colIdx, col)
                }}
              >
                {col.map((card, cardIdx) => {
                  if (!card.faceUp) {
                    return (
                      <div
                        key={card.id}
                        className="absolute left-0"
                        style={{ top: calcCardTop(col, cardIdx) }}
                      >
                        <GameCard.Back style={{ width: CARD_W, height: CARD_H }} />
                      </div>
                    )
                  }
                  return null
                })}
                {col.map((card, cardIdx) => {
                  if (!card.faceUp) return null
                  const isSelected = selected && selected.col === colIdx && cardIdx >= selected.idx
                  const isFlipping = flippingIds.has(card.id)
                  return (
                    <div
                      key={card.id}
                      className={`absolute left-0 ${isSelected ? 'z-10' : 'z-0'}`}
                      style={{ top: calcCardTop(col, cardIdx) }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCardClick(colIdx, cardIdx)
                      }}
                    >
                      <div className={`rounded-[5px] overflow-hidden transition-all ${isSelected ? 'ring-2 ring-school shadow-lg scale-105' : ''} ${isFlipping ? 'card-reveal' : ''}`}>
                        <GameCard.Face card={card} style={{ width: CARD_W, height: CARD_H }} />
                      </div>
                    </div>
                  )
                })}
                {col.length === 0 && (
                  <div className="absolute top-0 left-0 w-[52px] h-[72px] rounded-[5px] border-2 border-dashed border-slate-200" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(state === 'won' || state === 'lost') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4">
            <div className="text-5xl mb-3">{state === 'won' ? '🎉' : '😔'}</div>
            <h2 className="text-xl font-bold text-school mb-2">{state === 'won' ? '恭喜通关！' : '游戏结束'}</h2>
            <p className="text-sm text-slate-500 mb-4">用时 {formatTime(elapsed)} | 步数 {moves}</p>
            <button onClick={() => navigate('/games')} className="px-6 py-2 bg-school text-white rounded-lg">返回游戏列表</button>
          </div>
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
            <h3 className="font-bold text-lg text-school mb-3">🕷️ 蜘蛛纸牌规则</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>当前难度：</strong>{difficulty === 'easy' ? '🟢 简单 — 1 花色（全黑桃）' : '🔴 困难 — 4 花色'}</p>
              <p><strong>目标：</strong>将同一花色从 K 到 A 的完整序列移出牌面，集齐 {winGoal} 组即为胜利。</p>
              <p><strong>操作：</strong>点击一张牌选中（蓝色光环），再点击另一列的目标牌完成移动。</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>再次点击同一张牌可取消选中</li>
                <li>可点击列中任意已翻开的牌，选中该牌及下方同花色降序牌组</li>
                <li>选中的牌组移动到比它大 1 点的牌上（不限花色）或空列</li>
                <li>当一列底部出现完整 K→A 同花序列时自动移除</li>
                {difficulty === 'easy' && (
                  <li className="text-green-700">简单模式：全黑桃，无需考虑花色问题，只需 {winGoal} 组即可通关</li>
                )}
                {difficulty === 'hard' && (
                  <li className="text-red-700">困难模式：四花色各 2 副，同花色才能成组移动，需 {winGoal} 组通关</li>
                )}
              </ul>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="font-bold text-school text-xs mb-1">💡 游玩指南</p>
                <ul className="list-decimal pl-4 space-y-1 text-xs">
                  <li>尽量往同一列堆牌，建立长降序序列</li>
                  <li>优先清空一整列——空列是最佳策略资源</li>
                  <li>无好棋时点「发牌」补充新牌</li>
                  <li>点错了？点「↩ 撤销」撤回上一步</li>
                </ul>
              </div>
              <p><strong>计分：</strong>完成序列 ×100 + 剩余时间 ×2（初始 600 秒）。</p>
            </div>
            <button onClick={closeRules} className="w-full mt-4 py-2 rounded-lg bg-school text-white text-sm font-semibold">
              知道了
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 bg-schoolred text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-bold text-center pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
