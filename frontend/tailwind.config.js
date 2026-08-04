/** @type {import('tailwindcss').Config} */
export default {
  // Topos toggles the theme via a `data-theme="dark"` attribute on
  // <html> (see hooks/useTheme.ts), NOT a `.dark` class. Map Tailwind's
  // `dark:` variant onto that attribute so the prefix works as-is.
  darkMode: ["class", '[data-theme="dark"]'],
  // Include the ai-key-vault-react dist: the kit ships its layout as
  // Tailwind utility classes in the compiled JS, so Tailwind must scan
  // it or those classes get purged and the AI settings panel renders
  // unstyled (raw divs).
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@astrapi69/ai-key-vault-react/dist/**/*.{js,mjs}",
  ],
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
        // Compat aliases for @astrapi69/ai-key-vault-react: the kit's
        // markup uses shadcn-style token names. Map them onto Topos's
        // CSS vars so the panel inherits the app theme (light/dark).
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        border: "var(--border)",
        muted: {
          DEFAULT: "var(--surface-2)",
          foreground: "var(--text-muted)",
        },
        fg: {
          muted: "var(--text-muted)",
          secondary: "var(--text-secondary)",
        },
        destructive: "var(--danger)",
        success: "#16a34a",
        warning: "#d97706",
        error: "var(--danger)",
        info: "var(--accent)",
      },
      borderRadius: {
        app: "var(--radius, 0.5rem)",
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
