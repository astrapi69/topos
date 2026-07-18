/**
 * Tests for the palette registry.
 *
 * Pins the set of known palette IDs so a rename or deletion anywhere
 * in the codebase either propagates here (the conscious case) or
 * trips this test (the accidental case). Since the 2026-07-18
 * cleanup Topos ships exactly ONE palette; the five template
 * palettes (cool-modern, nord, classic, studio, notebook) were
 * removed together with their CSS blocks.
 */

import {describe, it, expect} from "vitest";
import {PALETTES, DEFAULT_PALETTE, isKnownPalette} from "./palettes";

describe("palette registry", () => {
    it("has exactly one palette (guards against accidental additions)", () => {
        expect(PALETTES).toHaveLength(1);
        expect(PALETTES[0].id).toBe("warm-literary");
    });

    it("no longer registers the removed template palettes", () => {
        for (const removed of ["cool-modern", "nord", "classic", "studio", "notebook"]) {
            expect(isKnownPalette(removed)).toBe(false);
        }
    });

    it("uses kebab-case IDs with no whitespace", () => {
        for (const palette of PALETTES) {
            expect(palette.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
        }
    });

    it("gives every palette a non-empty label", () => {
        for (const palette of PALETTES) {
            expect(palette.label.trim()).not.toBe("");
        }
    });

    it("defaults to warm-literary", () => {
        expect(DEFAULT_PALETTE).toBe("warm-literary");
        expect(isKnownPalette(DEFAULT_PALETTE)).toBe(true);
    });
});

describe("isKnownPalette", () => {
    it("returns true for every registered ID", () => {
        for (const palette of PALETTES) {
            expect(isKnownPalette(palette.id)).toBe(true);
        }
    });

    it("returns false for unknown IDs", () => {
        expect(isKnownPalette("cyberpunk-pink")).toBe(false);
        expect(isKnownPalette("")).toBe(false);
        expect(isKnownPalette("Warm-Literary")).toBe(false); // case sensitive
    });
});
