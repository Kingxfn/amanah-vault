/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // We manage dark/light ourselves via CSS custom properties — disable
  // Tailwind's automatic dark-mode variant so it never overrides our tokens.
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '400px',
      },
    },
  },
  plugins: [],
}

