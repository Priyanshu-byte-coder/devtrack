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
      // Motion tokens from globals.css (mirrored in src/lib/motion.ts).
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        in: "var(--ease-in)",
      },
      transitionDuration: {
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
      },
      // Type scale. Display sizes are fluid and deliberately large: the old
      // pages sat almost every heading in the same mid range, which is a big
      // part of why they read as generic.
      fontSize: {
        "display-xl": [
          "clamp(3.25rem, 8vw + 1rem, 8rem)",
          { lineHeight: "0.92", letterSpacing: "-0.045em", fontWeight: "800" },
        ],
        "display-lg": [
          "clamp(2.75rem, 5.5vw + 1rem, 5.5rem)",
          { lineHeight: "0.95", letterSpacing: "-0.04em", fontWeight: "800" },
        ],
        "display-md": [
          "clamp(2.25rem, 3.5vw + 1rem, 3.75rem)",
          { lineHeight: "1", letterSpacing: "-0.035em", fontWeight: "700" },
        ],
        headline: [
          "clamp(1.5rem, 1.5vw + 1rem, 2.25rem)",
          { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "700" },
        ],
        title: [
          "1.25rem",
          { lineHeight: "1.3", letterSpacing: "-0.015em", fontWeight: "600" },
        ],
        eyebrow: [
          "0.6875rem",
          { lineHeight: "1.2", letterSpacing: "0.14em", fontWeight: "600" },
        ],
        stat: [
          "clamp(2rem, 3vw + 1rem, 3.5rem)",
          { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "700" },
        ],
      },
      fontFamily: {
        display: [
          "var(--font-syne)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
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
