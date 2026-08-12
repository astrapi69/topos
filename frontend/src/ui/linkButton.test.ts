/**
 * A <button> that should read as a link needs `linkButton`, not `link`.
 *
 * Tailwind's Preflight is deliberately OFF in this project (it would
 * clobber the hand-written base styles in global.css), so nothing
 * resets the browser's own button chrome. A button carrying only the
 * `link` colour classes therefore renders as grey 13.33px Arial with a
 * 2px outset border next to 16px DM Sans links - measured live on the
 * About panel before this fix.
 *
 * Two pins: the class string carries the resets, and no button in the
 * codebase falls back to the bare `link` string again.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  danger,
  iconButton,
  iconButtonDanger,
  link,
  linkButton,
} from "./classes";

const SRC_DIR = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith(".tsx") && !entry.includes(".test.") ? [full] : [];
  });
}

/** Elements whose opening tag carries exactly `className={link}`. */
function linkStyledTags(source: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(/className=\{link\}/g)) {
    const before = source.slice(0, match.index);
    const opener = before.lastIndexOf("<");
    tags.push(before.slice(opener + 1).match(/^[A-Za-z]+/)?.[0] ?? "?");
  }
  return tags;
}

describe("linkButton", () => {
  it("resets the browser's button chrome", () => {
    // Each of these was visibly wrong on the deployed About panel.
    expect(linkButton).toContain("appearance-none"); // grey buttonface
    expect(linkButton).toContain("bg-transparent");
    expect(linkButton).toContain("border-none"); // 2px outset, style included
    expect(linkButton).toContain("p-0");
    expect(linkButton).toContain("cursor-pointer"); // was `default`
    expect(linkButton).toContain("[font:inherit]"); // was 13.33px Arial
  });

  it("keeps the link's own colour and hover, so the two match", () => {
    for (const token of link.split(" ")) {
      expect(linkButton).toContain(token);
    }
  });
});

describe("no button falls back to the bare link classes", () => {
  it("uses linkButton for every button styled as a link", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const source = readFileSync(file, "utf8");
      for (const tag of linkStyledTags(source)) {
        // <a> and react-router <Link> are real links: `link` is right there.
        if (tag === "button") offenders.push(file.replace(SRC_DIR, "src"));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("iconButton", () => {
  it("resets the chrome like linkButton but keeps a touch target", () => {
    for (const token of [
      "appearance-none",
      "bg-transparent",
      "border-none",
      "cursor-pointer",
    ]) {
      expect(iconButton).toContain(token);
    }
    // Icon-only controls need a hit area; text links do not.
    expect(iconButton).toMatch(/p-\d/);
  });

  it("uses the danger token, never a fixed red", () => {
    expect(iconButtonDanger).toContain(danger);
    expect(iconButtonDanger).not.toMatch(/text-red-\d/);
  });
});

describe("button colours stay on the token palette", () => {
  it("no <button> paints itself with a fixed-palette colour", () => {
    // Fixed palettes are forbidden for chrome (CLAUDE.md); the status
    // badges that legitimately use green/yellow/red are <span>s.
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<button\b/g)) {
        const tag = source.slice(match.index, source.indexOf(">", match.index));
        if (
          /(text|bg|border)-(red|green|blue|gray|slate|yellow)-\d/.test(tag)
        ) {
          offenders.push(file.replace(SRC_DIR, "src"));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("form controls inherit the app typeface", () => {
  it("global.css carries the Preflight-substitute font rule", () => {
    // Preflight is off, so nothing makes <button>/<input>/<select> inherit
    // the page font: every control would render in the browser's 13.33px
    // Arial next to DM Sans 16px text. Measured across the app before this
    // rule: 26 controls on Arial. One base rule fixes all of them and
    // cannot be forgotten by a new component, unlike per-class fixes.
    const css = readFileSync(join(SRC_DIR, "styles", "global.css"), "utf8");
    const rule = css.slice(css.indexOf("button,"));
    expect(rule).toMatch(/button,[\s\S]{0,120}(input|select|textarea)/);
    expect(rule.slice(0, 300)).toContain("font: inherit");
  });
});
