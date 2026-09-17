/*
 * Pre-paint theme for the static legal pages: follow the theme chosen in
 * the app (same storage keys and light/dark families as the pre-paint
 * script in index.html; src/legal/staticPages.test.ts pins the families
 * against src/themes/themes.ts). Without a stored choice, legal.css falls
 * back to prefers-color-scheme.
 */
(function () {
  try {
    var DARK_IDS = { dark: 1, "soft-pop": 1, "high-contrast": 1, ocean: 1 };
    var id = localStorage.getItem("topos-app-theme") || localStorage.getItem("topos-theme");
    if (!id) return;
    document.documentElement.setAttribute("data-theme", DARK_IDS[id] ? "dark" : "light");
  } catch (e) {
    /* storage blocked: the media query decides */
  }
})();
