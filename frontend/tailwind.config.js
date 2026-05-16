/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 扑克花色配色基线
        hearts: '#e3342f',
        spades: '#1a202c',
        clubs: '#2f855a',
        diamonds: '#dd6b20',
      },
    },
  },
  plugins: [],
}
