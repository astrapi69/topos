/**
 * Render public/og-image.png (1200x630) from public/og-image.svg.
 *
 * Uses the e2e workspace's Playwright Chromium so the bundled woff2
 * fonts (public/fonts/) resolve via @font-face - no system-wide font
 * install needed, which rsvg/inkscape would require.
 *
 * Usage:  node scripts/generate-og-image.mjs   (from frontend/)
 * Re-run after editing og-image.svg.
 */

import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");
const fontsDir = path.join(publicDir, "fonts");

const require = createRequire(path.join(here, "..", "..", "e2e", "package.json"));
const {chromium} = require("@playwright/test");

const svg = readFileSync(path.join(publicDir, "og-image.svg"), "utf-8")
    // Strip the XML prolog so the markup can be inlined into HTML.
    .replace(/<\?xml[^>]*\?>\s*/, "");

const fontFace = (family, file, weights) => `
    @font-face {
        font-family: "${family}";
        font-style: normal;
        font-weight: ${weights};
        src: url("file://${path.join(fontsDir, file)}") format("woff2");
    }`;

const html = `<!DOCTYPE html>
<html>
<head>
<style>
${fontFace("JetBrains Mono", "jetbrains-mono-latin.woff2", "400 500")}
${fontFace("DM Sans", "dm-sans-latin.woff2", "400 700")}
    * { margin: 0; padding: 0; }
    body { width: 1200px; height: 630px; overflow: hidden; }
    svg { display: block; }
</style>
</head>
<body>${svg}</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1});
await page.setContent(html, {waitUntil: "networkidle"});
await page.evaluate(() => document.fonts.ready);
const target = path.join(publicDir, "og-image.png");
await page.screenshot({path: target, clip: {x: 0, y: 0, width: 1200, height: 630}});
await browser.close();
console.log(`wrote ${target}`);
