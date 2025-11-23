/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Festina Lente Bronze/Brown theme
        primary: {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d9bd',
          300: '#e8bf8f',
          400: '#dca05e',
          500: '#cd853f', // Main bronze
          600: '#b8703a',
          700: '#995a32',
          800: '#7d4a2e',
          900: '#673d28',
        },
        bronze: {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d9bd',
          300: '#e8bf8f',
          400: '#dca05e',
          500: '#cd853f',
          600: '#b8703a',
          700: '#995a32',
          800: '#7d4a2e',
          900: '#673d28',
        },
        gray: {
          50: '#faf9f7',
          100: '#f3f1ed',
          200: '#e8e4dd',
          300: '#d5cfc4',
          400: '#b8b0a2',
          500: '#9a9080',
          600: '#7d7264',
          700: '#655a4f',
          800: '#4a423a',
          900: '#2d2722',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      },
    },
  },
  plugins: [],
};
