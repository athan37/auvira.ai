/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e8f2ff',
          100: '#d6e8ff',
          200: '#b3d4ff',
          300: '#80b8ff',
          400: '#4d9aff',
          500: '#0077ed',
          600: '#0071e3',
          700: '#0066cc',
          800: '#0055aa',
          900: '#004499',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#fbfbfd',
          muted: '#f5f5f7',
          dark: '#1d1d1f',
        },
        border: {
          DEFAULT: '#d2d2d7',
          strong: '#86868b',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'var(--font-inter)',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 0 0 1px rgb(0 0 0 / 0.03), 0 2px 4px rgb(0 0 0 / 0.04)',
        'card-hover': '0 0 0 1px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.06)',
        glass: '0 2px 16px rgb(0 0 0 / 0.06)',
        product: '0 8px 40px rgb(0 0 0 / 0.12)',
      },
      borderRadius: {
        DEFAULT: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(180deg, #f5f5f7 0%, #fbfbfd 100%)',
        'brand-cta': 'linear-gradient(180deg, #0077ed 0%, #0071e3 100%)',
        'dark-band': 'linear-gradient(180deg, #000000 0%, #1d1d1f 100%)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
    },
  },
  plugins: [],
};
