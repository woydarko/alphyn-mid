import type { Config } from 'tailwindcss';

// Mirrors the Next frontend theme so ported pages keep the exact Alphyn look.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Midnight dark theme. Token keys keep their historical names
        // (`orange`/`orangeDeep`) but now hold the dark-purple accent.
        background: '#0E0A1A',
        foreground: '#EDE9F7',
        alphyn: {
          orange: '#8B5CF6',      // dark-purple accent
          orangeDeep: '#7C3AED',  // accent, pressed/hover
          surface: '#171128',
          surfaceHover: '#211A3A',
          surfaceBorder: '#2C2348',
          text: '#EDE9F7',
          textMuted: '#9D92BC',
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
