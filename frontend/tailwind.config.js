/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 中山职业技术学院 VI:校徽蓝 + 校徽红
        school: {
          DEFAULT: '#0060A8',
          dark: '#004A82',
          deep: '#003A66',
          mid: '#1E7BC4',
          light: '#E8F1FA',
          tint: '#F4F8FC',
        },
        schoolred: {
          DEFAULT: '#E1232B',
          dark: '#B81B22',
        },
        // 王牌金(大小王 / 排行榜荣誉色)
        gold: {
          DEFAULT: '#E8B33A',
          dark: '#C8922A',
        },
        // 扑克花色:红=校徽红系,黑=校徽蓝系(贴合 logo 的红蓝双色)
        hearts: '#E1232B',
        diamonds: '#E1232B',
        spades: '#0060A8',
        clubs: '#0060A8',
      },
      boxShadow: {
        card: '0 6px 20px -8px rgba(0,58,102,0.22)',
        cardHover: '0 14px 30px -10px rgba(0,58,102,0.32)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  safelist: [
    'ring-2',
    'ring-school',
    'shadow-lg',
    'scale-105',
    'z-10',
    'z-0',
    'card-reveal',
  ],
  plugins: [],
}
