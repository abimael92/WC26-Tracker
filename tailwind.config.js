/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body: ['Poppins', 'sans-serif'],
      },
      colors: {
        pitch: '#06150f',
        gold: '#d4af37',
        emerald: '#00a76f',
      },
      boxShadow: {
        glow: '0 0 25px rgba(212, 175, 55, 0.35)',
      },
    },
  },
  plugins: [],
};
