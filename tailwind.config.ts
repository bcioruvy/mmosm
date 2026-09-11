import type { Config } from "tailwindcss";

/**
 * Preflight is off on purpose: this app has an existing hand-written
 * globals.css with its own tag-level defaults (button, table, input,
 * etc.) that every un-migrated page still depends on. Tailwind's utility
 * classes (higher specificity than a bare tag selector) still win
 * wherever they're used, so pages built with Tailwind render correctly
 * without preflight resetting every other page's baseline styling first.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          hover: "var(--color-brand-hover)",
          contrast: "var(--color-brand-contrast)",
          "contrast-muted": "var(--color-brand-contrast-muted)",
          tint: "var(--color-brand-tint)",
        },
        surface: "var(--color-surface)",
        muted: "var(--color-text-muted)",
        border: "var(--color-border)",
        success: "var(--color-success)",
        error: "var(--color-error)",
        warning: "var(--color-warning)",
        "warning-bg": "var(--color-warning-bg)",
      },
    },
  },
  plugins: [],
};

export default config;
