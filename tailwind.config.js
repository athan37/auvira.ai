/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/content/**/*.{js,ts,jsx,tsx,mdx}',
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
        rose: {
          50: '#F1CDD7',
          100: '#F1CDD7',
          200: '#F1CDD7',
          300: '#DD8399',
          400: '#DD8399',
          500: '#C83E5F',
          600: '#D24460',
          700: '#BD365E',
          800: '#1C1C1F',
          900: '#1C1C1F',
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
        'rose-glass': '0 20px 60px rgba(200, 62, 95, 0.12)',
        'rose-cta': '0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(200, 62, 95, 0.32)',
        'rose-cta-hover': '0 2px 4px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(200, 62, 95, 0.38)',
        'cta-blue': '0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(59, 130, 246, 0.32)',
        'cta-blue-hover': '0 2px 4px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(59, 130, 246, 0.38)',
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
        'rose-gradient': 'linear-gradient(135deg, #D24460 0%, #C83E5F 45%, #BD365E 100%)',
        'rose-gradient-cta': 'linear-gradient(180deg, #E85672 0%, #D24460 38%, #BD365E 100%)',
        'rose-glow': 'radial-gradient(circle at center, rgba(210,68,96,0.22), transparent 60%)',
        'rose-glow-soft': 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(210,68,96,0.08), transparent 55%)',
        'mesh-canvas':
          'radial-gradient(ellipse 55% 45% at 8% 18%, rgba(184,216,245,0.55), transparent 68%), radial-gradient(ellipse 50% 42% at 52% 12%, rgba(248,232,168,0.48), transparent 62%), radial-gradient(ellipse 48% 40% at 92% 28%, rgba(216,200,245,0.52), transparent 65%), radial-gradient(ellipse 55% 48% at 35% 88%, rgba(245,212,232,0.42), transparent 68%), linear-gradient(165deg, #f4f6fc 0%, #eef2fb 55%, #f8f4fc 100%)',
        'cta-gradient': 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 42%, #2563eb 100%)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      keyframes: {
        'rose-shimmer-sweep': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'rose-shimmer': 'rose-shimmer-sweep 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
