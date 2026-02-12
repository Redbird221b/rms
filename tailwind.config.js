/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#f3f5f8',
          panel: '#ffffff',
          panelDark: '#111827',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.05)',
      },
      borderRadius: {
        xl: '0.85rem',
      },
    },
  },
  plugins: [],
}
