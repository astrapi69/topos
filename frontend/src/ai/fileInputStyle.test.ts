/**
 * Pins that Topos styles the kit's file-picker button.
 *
 * @astrapi69/ai-key-vault-react 0.3.2 stopped shipping any appearance
 * for the native file input in the key-import form: it renders just a
 * stable `akv-file-input` class, on the same slot philosophy as its
 * Button/Input/Link props. Without a host rule the browser default
 * chrome shows through - light grey on the dark theme, the trap already
 * recorded for bare buttons in lessons-learned.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(__dirname, "..", "styles", "global.css"),
  "utf8",
);

describe("kit file-input styling", () => {
  it("styles the file-selector button of .akv-file-input", () => {
    expect(css).toContain(".akv-file-input::file-selector-button");
  });

  it("uses theme tokens rather than fixed colours", () => {
    const rule = css.slice(css.indexOf(".akv-file-input::file-selector-button"));
    const block = rule.slice(0, rule.indexOf("}"));
    expect(block).toMatch(/var\(--/);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
