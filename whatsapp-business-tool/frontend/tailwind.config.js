/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WhatsApp iOS palette - light mode
        wa: {
          green: '#25D366',
          'green-dark': '#128C7E',
          teal: '#075E54',
          'bubble-out': '#D9FDD3',
          'bubble-in': '#FFFFFF',
          bg: '#F7F7F7',
          divider: '#E9E9E9',
          'text-secondary': '#667781',
        },
        // WhatsApp iOS palette - dark mode
        wad: {
          bg: '#0B141A',
          panel: '#111B21',
          'bubble-out': '#005C4B',
          'bubble-in': '#202C33',
          divider: '#222D34',
          'text-secondary': '#8696A0',
        },
      },
      fontFamily: {
        sf: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        bubble: '18px',
      },
    },
  },
  plugins: [],
};
