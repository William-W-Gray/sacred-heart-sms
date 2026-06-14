import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Sacred Heart brand palette
        gold: {
          DEFAULT: "#C8A84B",
          light:   "#E8C96A",
          pale:    "#FDF6E3",
          dim:     "#8B6F2A",
        },
        navy: {
          DEFAULT: "#1A2A4A",
          deep:    "#0D1A33",
          light:   "#2A3F6A",
          pale:    "#EEF2F8",
        },
        crimson: {
          DEFAULT: "#8B1A1A",
          light:   "#C42B2B",
        },
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans:  ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono:  ["var(--font-dm-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(26,42,74,0.08), 0 4px 12px rgba(26,42,74,0.06)",
        lg:   "0 8px 32px rgba(26,42,74,0.12), 0 2px 8px rgba(26,42,74,0.08)",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
