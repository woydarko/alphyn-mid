import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Playful Vault colors (Light Mode)
        alphyn: {
          orange: "#FF5E1A",    // Warm, saturated orange action color
          orangeDeep: "#E0480C",
          surface: "#FFFFFF",   // Pure white for cards
          surfaceHover: "#F7F4EF",
          surfaceBorder: "#EAE5DF",
          text: "#2D2622",      // Deep charcoal for main text
          textMuted: "#8A7D74", // Warm gray for secondary text
        }
      },
      fontFamily: {
        sans: ["var(--font-outfit)"],
        mono: ["var(--font-jetbrains-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
