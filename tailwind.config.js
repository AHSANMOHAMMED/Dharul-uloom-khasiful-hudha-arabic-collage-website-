/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'islamic-green': '#0F5132',
        'islamic-gold': '#FFD700',
        'islamic-beige': '#F5F5DC',
        'islamic-dark': '#1A3C2E',
      },
      fontFamily: {
        'arabic': ['Amiri', 'serif'],
        'sans': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
