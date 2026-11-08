/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Modern Manuscript Design System Tokens
        'ink-green-900': '#0B3B2E',
        'emerald-700': '#11694A',
        'emerald-500': '#1E8A63',
        'mint-wash-100': '#E3F1EA',
        'brass-gold-500': '#C29A3A',
        'gold-wash-100': '#F7EDD2',
        'parchment-50': '#FBF8F0',
        'paper-white': '#FFFFFF',
        'sand-border': '#E8E1D0',
        'sand-200': '#E8E1D0',
        'ink-text-primary': '#14201B',
        'ink-text-secondary': '#4B5A53',
        'ink-text-muted': '#7C8A83',

        // Feedback / Semantic
        'feedback-success': '#1F8A4C',
        'feedback-warning': '#C77D0A',
        'feedback-danger': '#B3261E',
        'feedback-info': '#1D5FA8',

        // Role Accents
        'role-student': '#11694A',
        'role-parent': '#D98A1F',
        'role-tutor': '#0F7C86',
        'role-treasurer': '#C29A3A',
        'role-principal': '#0B3B2E',
        'role-vice-principal': '#3949AB',
        'role-librarian': '#8C2F39',
        'role-admin': '#2F5D50',

        // Dark Canvas / Surfaces
        'dark-canvas': '#0C1512',
        'dark-surface': '#13201B',
        'dark-border': '#223329',
        'dark-text-primary': '#EAF2EE',

        // Legacy / Generic aliases mapped to new palette
        'islamic-green': '#11694A',
        'islamic-gold': '#C29A3A',
        'islamic-beige': '#FBF8F0',
        'islamic-dark': '#0B3B2E',
      },
      fontFamily: {
        'serif': ['"Newsreader"', '"Fraunces"', '"Amiri"', 'serif'],
        'display': ['"Newsreader"', '"Fraunces"', '"Amiri"', 'serif'],
        'headline': ['"Newsreader"', '"Fraunces"', '"Amiri"', 'serif'],
        'sans': ['"Inter"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        'body': ['"Inter"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        'arabic': ['"Amiri"', '"Noto Naskh Arabic"', '"IBM Plex Sans Arabic"', 'serif'],
        'naskh': ['"Noto Naskh Arabic"', '"Amiri"', 'serif'],
        'scheherazade': ['"Amiri"', '"Noto Naskh Arabic"', 'serif'],
      },
      borderRadius: {
        'btn': '10px',
        'card': '14px',
      },
      boxShadow: {
        'manuscript-sm': '0 1px 3px rgba(11, 59, 46, 0.04)',
        'manuscript': '0 2px 8px -2px rgba(11, 59, 46, 0.05)',
        'manuscript-md': '0 4px 16px -4px rgba(11, 59, 46, 0.08), 0 1px 2px rgba(11, 59, 46, 0.04)',
        'manuscript-lg': '0 12px 32px -8px rgba(11, 59, 46, 0.12), 0 2px 6px rgba(11, 59, 46, 0.06)',
      },
      animation: {
        'marquee': 'marquee 25s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
}
