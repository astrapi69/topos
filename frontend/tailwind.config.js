/** @type {import('tailwindcss').Config} */
export default {
  // Topos toggles the theme via a `data-theme="dark"` attribute on
  // <html> (see hooks/useTheme.ts), NOT a `.dark` class. Map Tailwind's
  // `dark:` variant onto that attribute so the prefix works as-is.
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // The app already ships a large hand-written global.css with its own
  // resets and the .btn / dialog component system. Disable Tailwind's
  // Preflight so it does not clobber those base styles; we only want the
  // utility classes.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // Bridge to the CSS custom properties in src/styles/global.css.
      // Every colour-bearing utility in the app goes through these
      // tokens so light/dark (data-theme) and the palette blocks stay
      // the single source of truth. The values flip with the theme,
      // which makes most `dark:` colour variants unnecessary.
      colors: {
        page: "var(--bg-primary)",
        surface: {
          DEFAULT: "var(--bg-card)",
          2: "var(--surface-2)",
          hover: "var(--bg-hover)",
        },
        ink: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          light: "var(--accent-light)",
          subtle: "var(--accent-subtle)",
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          hover: "var(--danger-hover)",
          bg: "var(--danger-bg)",
          strong: "var(--danger-strong)",
        },
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
};
