import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // kami · 紙 palette — warm parchment canvas, ink-blue accent
        parchment: '#f5f4ed',
        ivory: '#faf9f5',
        sand: '#e8e6dc',
        ink: { DEFAULT: '#1B365D', light: '#2D5A8A', tint: '#EEF2F7' },
        near: '#141413',
        stone: '#6b6a64',
        line: '#d8d5c8',
      },
      fontFamily: {
        serif: ['Charter', 'Georgia', 'Palatino', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [typography],
}
