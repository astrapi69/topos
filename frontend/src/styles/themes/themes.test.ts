/**
 * Theme token-parity test.
 *
 * Every non-base theme file must redefine the SAME colour-token set the base
 * dark palette overrides in global.css (`[data-theme="dark"]`). A theme that
 * misses a token would silently inherit the base value (wrong colour); an
 * extra token would be dead. Both trip this test.
 *
 * The contract is derived from global.css at run time, so adding a token to
 * the base palettes forces every theme file to declare it too.
 */

import {describe, it, expect} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

import {THEMES} from "../../themes/themes";

const stylesDir = resolve(__dirname, "..");

function tokensIn(css: string, blockRe: RegExp): Set<string> {
    const block = css.match(blockRe);
    expect(block, `block not found for ${blockRe}`).not.toBeNull();
    const names = [...block![1].matchAll(/--([a-z0-9-]+)\s*:/g)].map((match) => match[1]);
    return new Set(names);
}

// The contract: exactly the tokens the base dark palette overrides.
const globalCss = readFileSync(resolve(stylesDir, "global.css"), "utf-8");
const CONTRACT = tokensIn(globalCss, /\[data-theme="dark"\]\s*\{([^}]*)\}/);

// Themes with a dedicated data-app-theme override file (light + dark are the
// base palettes in global.css and have no override file).
const OVERRIDE_THEMES = THEMES.filter((theme) => theme.id !== "light" && theme.id !== "dark");

describe("theme token parity", () => {
    it("derives a non-empty contract from the base dark palette", () => {
        expect(CONTRACT.size).toBeGreaterThan(20);
    });

    for (const theme of OVERRIDE_THEMES) {
        it(`theme "${theme.id}" declares exactly the contract token set`, () => {
            const css = readFileSync(resolve(stylesDir, "themes", `theme-${theme.id}.css`), "utf-8");
            const declared = tokensIn(
                css,
                new RegExp(`:root\\[data-app-theme="${theme.id}"\\]\\s*\\{([^}]*)\\}`),
            );

            const missing = [...CONTRACT].filter((token) => !declared.has(token));
            const extra = [...declared].filter((token) => !CONTRACT.has(token));
            expect(missing, `theme ${theme.id} missing tokens`).toEqual([]);
            expect(extra, `theme ${theme.id} has extra tokens`).toEqual([]);
        });
    }
});
