import SpiderSolitaire from '../pages/SpiderSolitaire'
import Klondike from '../pages/Klondike'
import FreeCell from '../pages/FreeCell'
import Pyramid from '../pages/Pyramid'
import TriPeaks from '../pages/TriPeaks'
import Golf from '../pages/Golf'
import Clock from '../pages/Clock'

export const PUBLIC_GAMES = [
  {
    gameId: 'spider_solitaire',
    route: '/game/spider_solitaire',
    emoji: '🕷',
    component: SpiderSolitaire,
  },
  {
    gameId: 'klondike',
    route: '/game/klondike',
    emoji: '🃏',
    component: Klondike,
  },
  {
    gameId: 'freecell',
    route: '/game/freecell',
    emoji: '🗂',
    component: FreeCell,
  },
  {
    gameId: 'pyramid',
    route: '/game/pyramid',
    emoji: '🔺',
    component: Pyramid,
  },
  {
    gameId: 'tripeaks',
    route: '/game/tripeaks',
    emoji: '⛰',
    component: TriPeaks,
  },
  {
    gameId: 'golf',
    route: '/game/golf',
    emoji: '⛳',
    component: Golf,
  },
  {
    gameId: 'clock',
    route: '/game/clock',
    emoji: '🕙',
    component: Clock,
  },
]

export const PUBLIC_GAME_IDS = PUBLIC_GAMES.map((game) => game.gameId)

export const PUBLIC_GAME_META = PUBLIC_GAMES.reduce((acc, game) => {
  acc[game.gameId] = game
  return acc
}, {})
