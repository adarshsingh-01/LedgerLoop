/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b2430',
        paper: '#f3efe6',
        card: '#fffdf8',
        line: '#e3daca',
        moss: '#1d6b45',
        clay: '#9d3b24',
        brass: '#a56b12',
        mist: '#6f675c',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Outfit', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
