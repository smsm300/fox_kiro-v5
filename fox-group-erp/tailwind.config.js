/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
        'libre-barcode': ['"Libre Barcode 39 Text"', 'cursive'],
      },
      colors: {
        fox: {
          50: '#e6f2f2',
          100: '#cce6e6',
          200: '#99cccc',
          300: '#66b3b3',
          400: '#339999',
          500: '#0D4D4D', // Fox Group Primary - Teal/Petrol
          600: '#0a3d3d',
          700: '#082e2e',
          800: '#051f1f',
          900: '#030f0f',
          950: '#020808',
        },
        accent: {
          50: '#fef7e6',
          100: '#fdefcc',
          200: '#fbdf99',
          300: '#f9cf66',
          400: '#f7bf33',
          500: '#F7A400', // Fox Group Accent - Gold/Orange
          600: '#c68300',
          700: '#946200',
          800: '#634200',
          900: '#312100',
        },
        dark: {
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
      }
    },
  },
  plugins: [],
}
