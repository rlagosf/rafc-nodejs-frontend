/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'fucsia-ra': '#e82d89',
        'marron-ra': '#1d0b0b',
      },
      fontFamily: {
        sans: ['"Bebas Neue"', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        tightish: '-0.01em',
        wideish: '0.02em',
      },
      fontSize: {
        // 🔠 Ajuste global: ligeramente más grande (~17px)
        base: ['1.07rem', { lineHeight: '1.6' }],
      },
    },
  },
  plugins: [],
};
