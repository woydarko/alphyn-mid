import type { Config } from 'tailwindcss';

// Mirrors the Next frontend theme so ported pages keep the exact Alphyn look.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FDFBF7',
        foreground: '#2D2622',
        alphyn: {
          orange: '#FF5E1A',
          orangeDeep: '#E0480C',
          surface: '#FFFFFF',
          surfaceHover: '#F7F4EF',
          surfaceBorder: '#EAE5DF',
          text: '#2D2622',
          textMuted: '#8A7D74',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
