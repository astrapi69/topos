/** @type {import('tailwindcss').Config} */
export default {
  // Topos toggles the theme via a `data-theme="dark"` attribute on
  // <html> (see hooks/useTheme.ts), NOT a `.dark` class. Map Tailwind's
  // `dark:` variant onto that attribute so the prefix works as-is.
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // @astrapi69/ai-key-vault-react builds its classNames with template
  // literals (`flex ${cond}`), which Tailwind's regex content scanner
  // cannot extract from the compiled dist - so scanning node_modules is
  // not enough and the panel's layout classes get purged (rows collapse,
  // no spacing). Safelist the kit's full class set (extracted from the
  // kit source) so they are always generated. Update when the kit bumps.
  safelist: [
    "absolute", "bg-[var(--warning-bg)]", "bg-background", "bg-muted", "border",
    "border-border", "border-warning", "flex", "flex-1", "flex-col", "flex-wrap",
    "font-mono", "font-semibold", "gap-2", "gap-6", "gap-[0.4rem]", "h-5", "h-7",
    "hidden", "inline-flex", "items-center", "items-start", "justify-between",
    "justify-center", "list", "m-0", "mb-2", "mb-3", "min-h-4", "ml-auto",
    "mt-0.5", "mt-[0.4rem]", "outline", "p-2", "p-3", "pr-11", "px-[0.9rem]",
    "py-[0.6rem]", "relative", "right-2", "rounded", "rounded-app", "shrink-0",
    "text-[0.9rem]", "text-accent", "text-destructive", "text-error",
    "text-fg-muted", "text-fg-secondary", "text-foreground", "text-info",
    "text-muted-foreground", "text-sm", "text-success", "text-warning", "text-xs",
    "underline", "w-5", "w-7", "w-full",
    // SecretInput masks its value with this arbitrary class and drops it
    // on reveal; without it the field never masks and the eye toggle
    // appears to do nothing.
    "[-webkit-text-security:disc]",
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
