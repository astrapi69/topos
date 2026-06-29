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
    extend: {},
  },
  plugins: [],
};
