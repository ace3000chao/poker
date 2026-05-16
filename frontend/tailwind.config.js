/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 品牌主色:蒂芙尼蓝
        tiffany: {
          DEFAULT: '#71E2D1',
          light: '#A8EFE4',
          dark: '#3FC9B4',
          deep: '#0E4D45', // 深蒂芙尼,用于文字/对比(替代黑色)
        },
        // 扑克花色(避免纯黑,黑桃改深蒂芙尼)
        hearts: '#E2474B',
        spades: '#0E4D45',
        clubs: '#2F855A',
        diamonds: '#E0892E',
      },
      boxShadow: {
        card: '0 6px 20px -6px rgba(14,77,69,0.25)',
        cardHover: '0 14px 30px -8px rgba(14,77,69,0.35)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
