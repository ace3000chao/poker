// =============================================================
//  卡面素材配置 — 接入实际图片素材后只需改 enabled 为 true
// =============================================================
//
//  素材目录（放在 public/ 下，不经过 webpack 打包）：
//    public/assets/cards/
//    ├── back.png               ← 牌背（1 张，所有游戏共用）
//    └── faces/
//        ├── AS.png ~ KS.png    ← 黑桃 13 张
//        ├── AH.png ~ KH.png    ← 红桃 13 张
//        ├── AC.png ~ KC.png    ← 梅花 13 张
//        └── AD.png ~ KD.png    ← 方块 13 张
//
//  Rank 编码: A,2,3,4,5,6,7,8,9,T,J,Q,K  (T 代替 10)
//  Suit 编码: S,H,C,D
//
//  接入步骤（不改任何代码）：
//    1. 把 53 张 PNG 放入上述目录
//    2. 将下方的 enabled 改为 true
//    3. 刷新页面即可
// =============================================================

const CARD_ASSETS = {
  /** 素材是否就绪。设为 true 后全局启用图片模式 */
  enabled: false,

  /** 牌背图片路径 */
  back: '/assets/cards/back.png',
}

const RANK_KEY = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
const SUIT_KEY = { S: 'S', H: 'H', C: 'C', D: 'D' }

/**
 * 根据 rank(0-12) 和 suit(S/H/C/D) 生成牌面图片路径
 * 例: faceImage(0, 'S') → '/assets/cards/faces/AS.png'
 */
export function faceImage(rank, suit) {
  if (!CARD_ASSETS.enabled) return null
  return `/assets/cards/faces/${RANK_KEY[rank]}${SUIT_KEY[suit]}.png`
}

/**
 * 获取牌背图片路径。enabled=false 时返回 null
 */
export function backImage() {
  if (!CARD_ASSETS.enabled) return null
  return CARD_ASSETS.back
}
