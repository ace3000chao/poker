// 五张牌型判定 + 趣味加权抽牌。纯前端,作用于 listCards 返回的牌对象
// (含 suit: spades/hearts/clubs/diamonds, rank: 'A'|'2'..'10'|'J'|'Q'|'K')。

const RANK_VALUE = {
  2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  J: 11, Q: 12, K: 13, A: 14,
}
const SUITS = ['spades', 'hearts', 'clubs', 'diamonds']

// 牌型等级:数字越大越好(也用于"本次最佳"比较)
export const HANDS = {
  HIGH: { rank: 1, name: '高牌' },
  PAIR: { rank: 2, name: '对子' },
  TWO_PAIR: { rank: 3, name: '两对' },
  TRIPS: { rank: 4, name: '三条' },
  STRAIGHT: { rank: 5, name: '顺子' },
  FLUSH: { rank: 6, name: '同花' },
  FULL_HOUSE: { rank: 7, name: '葫芦' },
  QUADS: { rank: 8, name: '四条' },
  STRAIGHT_FLUSH: { rank: 9, name: '同花顺' },
  ROYAL: { rank: 10, name: '皇家同花顺' },
}
// ≥ 同花 视为"好牌型"(触发庆祝 + 保底目标)
export const GOOD_HAND_RANK = HANDS.FLUSH.rank

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rankVal(card) {
  return RANK_VALUE[card.rank]
}

// 判定 5 张牌的牌型,返回 HANDS 中的一项。
export function evaluateHand(cards) {
  const vals = cards.map(rankVal).sort((a, b) => a - b)
  const suits = cards.map((c) => c.suit)
  const isFlush = suits.every((s) => s === suits[0])

  const uniq = [...new Set(vals)]
  let isStraight = false
  if (uniq.length === 5) {
    if (uniq[4] - uniq[0] === 4) isStraight = true
    // A-2-3-4-5 轮子顺
    if (uniq.join(',') === '2,3,4,5,14') isStraight = true
  }

  // 各 rank 出现次数,降序
  const counts = {}
  for (const v of vals) counts[v] = (counts[v] || 0) + 1
  const groups = Object.values(counts).sort((a, b) => b - a)

  if (isStraight && isFlush) {
    return uniq[0] === 10 ? HANDS.ROYAL : HANDS.STRAIGHT_FLUSH
  }
  if (groups[0] === 4) return HANDS.QUADS
  if (groups[0] === 3 && groups[1] === 2) return HANDS.FULL_HOUSE
  if (isFlush) return HANDS.FLUSH
  if (isStraight) return HANDS.STRAIGHT
  if (groups[0] === 3) return HANDS.TRIPS
  if (groups[0] === 2 && groups[1] === 2) return HANDS.TWO_PAIR
  if (groups[0] === 2) return HANDS.PAIR
  return HANDS.HIGH
}

// ---- 趣味加权抽牌 ----
// 思路:先按权重选一个"目标牌型",再从全 52 张里构造出符合该牌型的 5 张真实校友牌。
// 显示一律以 evaluateHand 复核结果为准(构造若意外更好,只会显示更好的牌型)。

// 目标牌型权重(明显抬高好牌占比,压低高牌,确保动画常能看到炫酷牌型)
const WEIGHTS = [
  ['HIGH', 4],
  ['PAIR', 14],
  ['TWO_PAIR', 12],
  ['TRIPS', 12],
  ['STRAIGHT', 16],
  ['FLUSH', 16],
  ['FULL_HOUSE', 10],
  ['QUADS', 5],
  ['STRAIGHT_FLUSH', 6],
]

function buildIndex(deck) {
  const byRank = {}   // value -> [cards]
  const bySuit = {}   // suit -> [cards]
  for (const c of deck) {
    const v = rankVal(c)
    ;(byRank[v] = byRank[v] || []).push(c)
    ;(bySuit[c.suit] = bySuit[c.suit] || []).push(c)
  }
  return { byRank, bySuit }
}

// 所有可能的顺子窗口(轮子顺用 [14,2,3,4,5])
const STRAIGHT_WINDOWS = (() => {
  const w = [[14, 2, 3, 4, 5]]
  for (let lo = 2; lo <= 10; lo++) w.push([lo, lo + 1, lo + 2, lo + 3, lo + 4])
  return w
})()

function chooseTarget(minRank) {
  const pool = WEIGHTS.filter(([k]) => HANDS[k].rank >= (minRank || 0))
  const total = pool.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [k, w] of pool) {
    if ((r -= w) <= 0) return k
  }
  return pool[pool.length - 1][0]
}

function construct(target, idx, deck) {
  const { byRank, bySuit } = idx
  const ranksWith4 = Object.keys(byRank).map(Number)

  const cardByRankSuit = (val, suit) =>
    byRank[val].find((c) => c.suit === suit)

  switch (target) {
    case 'STRAIGHT_FLUSH': {
      const suit = pick(SUITS)
      const win = pick(STRAIGHT_WINDOWS)
      return win.map((v) => cardByRankSuit(v, suit))
    }
    case 'FLUSH': {
      const suit = pick(SUITS)
      // 取同花色 5 个随机 rank(评估若恰好连号会显示成同花顺,也无妨)
      return shuffle(bySuit[suit]).slice(0, 5)
    }
    case 'STRAIGHT': {
      const win = pick(STRAIGHT_WINDOWS)
      return win.map((v) => pick(byRank[v]))
    }
    case 'QUADS': {
      const quad = pick(ranksWith4)
      const kicker = pick(deck.filter((c) => rankVal(c) !== quad))
      return [...byRank[quad], kicker]
    }
    case 'FULL_HOUSE': {
      const [a, b] = shuffle(ranksWith4)
      return [...shuffle(byRank[a]).slice(0, 3), ...shuffle(byRank[b]).slice(0, 2)]
    }
    case 'TRIPS': {
      const [a, b, c] = shuffle(ranksWith4)
      return [
        ...shuffle(byRank[a]).slice(0, 3),
        pick(byRank[b]), pick(byRank[c]),
      ]
    }
    case 'TWO_PAIR': {
      const [a, b, c] = shuffle(ranksWith4)
      return [
        ...shuffle(byRank[a]).slice(0, 2),
        ...shuffle(byRank[b]).slice(0, 2),
        pick(byRank[c]),
      ]
    }
    case 'PAIR': {
      const [a, b, c, d] = shuffle(ranksWith4)
      return [...shuffle(byRank[a]).slice(0, 2), pick(byRank[b]), pick(byRank[c]), pick(byRank[d])]
    }
    default: // HIGH 及兜底
      return shuffle(deck).slice(0, 5)
  }
}

// 抽 5 张。minRank 用于保底(强制本次目标 ≥ 该等级)。
// 返回 { cards: [...5], hand: HANDS.* }
export function drawWeightedHand(deck, { minRank = 0 } = {}) {
  if (!deck || deck.length < 5) return null
  const idx = buildIndex(deck)
  const target = chooseTarget(minRank)
  let cards = construct(target, idx, deck)
  // 去重兜底:构造异常(出现重复牌)时退化为公平随机
  const keys = new Set(cards.map((c) => c.card_key))
  if (cards.length !== 5 || keys.size !== 5 || cards.some((c) => !c)) {
    cards = shuffle(deck).slice(0, 5)
  }
  return { cards: shuffle(cards), hand: evaluateHand(cards) }
}
