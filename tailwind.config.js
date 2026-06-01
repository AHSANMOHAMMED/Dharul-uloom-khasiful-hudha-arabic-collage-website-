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
        // Elegant Naskh families for Arabic/Urdu body and headings.
        'arabic': ['"Amiri"', '"Scheherazade New"', '"Noto Naskh Arabic"', 'serif'],
        'naskh': ['"Noto Naskh Arabic"', '"Amiri"', 'serif'],
        'scheherazade': ['"Scheherazade New"', '"Amiri"', 'serif'],
        'sans': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
