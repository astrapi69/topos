/**
 * ESLint, flat config (ESLint 10).
 *
 * Correctness only - no style rules. Prettier owns formatting and runs
 * as its own pre-commit hook; a linter that also argues about quotes
 * just produces conflicts and noise.
 *
 * `typescript-eslint` is the official meta-package: it pulls in both
 * @typescript-eslint/parser and the plugin, so the flat config stays
 * one import instead of wiring the two by hand.
 *
 * Type-aware rules (`recommendedTypeChecked`) are deliberately NOT on:
 * they need a full program per run, which turns a pre-commit lint into
 * a multi-second wait. `tsc --noEmit` already covers type errors.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "public/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // eslint-plugin-react-hooks 7 bundles the React Compiler checks.
      // The genuine correctness rule stays an error; the compiler-era
      // ones report a *preferred shape* (write refs in an effect, hoist
      // setState out of effects, let the compiler memoise) rather than a
      // defect, and this codebase predates them. They stay visible as
      // warnings instead of blocking commits on a refactor of working
      // code - and instead of the other option, deleting the rules,
      // which would hide them for good. Backlog: work them off file by
      // file, then raise the ones that are clean back to error.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",

      // TypeScript resolves globals and undefined names; the core rule
      // would only produce false positives for `document`, `window`, ...
      "no-undef": "off",

      // Project rules from .claude/rules/code-hygiene.md.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // User feedback belongs in toasts (react-toastify), never the
      // console; warn/error stay allowed for genuine developer output.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Tests reach for casts and throwaway shapes that would be wrong in
    // production code; keeping `any` an error there buys nothing.
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
);
