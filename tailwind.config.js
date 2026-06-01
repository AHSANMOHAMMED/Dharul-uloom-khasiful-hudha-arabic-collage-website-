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
      animation: {
        'marquee': 'marquee 25s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.3)',
      }
    },
  },
  plugins: [],
}
