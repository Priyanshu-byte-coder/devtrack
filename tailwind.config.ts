import plugin from "tailwindcss/plugin";
import type { Config } from "tailwindcss";

const themeColor = (name: string) =>
  `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // CSS variables hold plain hex colors, so opacity modifiers (bg-accent/20)
      // are applied with color-mix; Tailwind substitutes <alpha-value>.
      colors: {
        background: themeColor("background"),
        foreground: themeColor("foreground"),
        muted: themeColor("muted"),
        "muted-foreground": themeColor("muted-foreground"),
        card: themeColor("card"),
        "card-foreground": themeColor("card-foreground"),
        "card-muted": themeColor("card-muted"),
        border: themeColor("border"),
        accent: {
          DEFAULT: themeColor("accent"),
          foreground: themeColor("accent-foreground"),
          secondary: themeColor("accent-secondary"),
          soft: themeColor("accent-soft"),
        },
        control: themeColor("control"),
        "control-hover": themeColor("control-hover"),
        ring: themeColor("ring"),
        success: themeColor("success"),
        warning: themeColor("warning"),
        destructive: {
          DEFAULT: themeColor("destructive"),
          foreground: themeColor("destructive-foreground"),
          muted: themeColor("destructive-muted"),
        },
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out both",
        "scale-in": "scale-in 0.3s ease-out both",
        shimmer: "shimmer 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [
    require("tailwind-scrollbar")({ nocompatible: true }),
    plugin(function ({ addBase }) {
      addBase({
        "*:focus": {
          outline: "none",
        },
        "*:focus-visible": {
          outline: "2px solid var(--accent)",
          outlineOffset: "2px",
        },
      });
    }),
  ],
};

export default config;
