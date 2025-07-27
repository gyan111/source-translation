module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: {
        'extra-large': '1.5rem',
      },
      gradientColorStops: {
        'primary-start': '#6366f1',
        'primary-end': '#8b5cf6',
        'secondary-start': '#f59e0b',
        'secondary-end': '#d97706',
      }
    },
  },
  plugins: [],
}
