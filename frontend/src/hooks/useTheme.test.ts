/**
 * Tests for the useTheme hook (multi-theme).
 *
 * Covers: default, OS fallback, stored theme id, migration from the old
 * light/dark key, unknown-value guard, setTheme, light/dark toggle, and the
 * two DOM attributes (data-theme = family, data-app-theme = id) + persistence.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useTheme } from "./useTheme";
import { DEFAULT_THEME } from "../themes/themes";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-app-theme");
});

describe("useTheme", () => {
  describe("initial theme", () => {
    it("defaults to light with no stored value and no system dark mode", () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe(DEFAULT_THEME);
      expect(result.current.theme).toBe("light");
    });

    it("reads a stored theme id", () => {
      localStorage.setItem("topos-app-theme", "soft-pop");
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe("soft-pop");
    });

    it("migrates the old light/dark key when no theme id is stored", () => {
      localStorage.setItem("topos-theme", "dark");
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe("dark");
    });

    it("falls back to default for an unknown stored value (e.g. removed palette)", () => {
      localStorage.setItem("topos-app-theme", "warm-literary");
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe("light");
    });
  });

  describe("family", () => {
    it("reports dark for a dark-family theme", () => {
      localStorage.setItem("topos-app-theme", "high-contrast");
      const { result } = renderHook(() => useTheme());
      expect(result.current.family).toBe("dark");
    });

    it("reports light for a light-family theme", () => {
      localStorage.setItem("topos-app-theme", "graphite");
      const { result } = renderHook(() => useTheme());
      expect(result.current.family).toBe("light");
    });
  });

  describe("setTheme", () => {
    it("sets both attributes: data-theme=family, data-app-theme=id", () => {
      const { result } = renderHook(() => useTheme());
      act(() => result.current.setTheme("soft-pop"));
      expect(document.documentElement.getAttribute("data-app-theme")).toBe(
        "soft-pop",
      );
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("persists the theme id to topos-app-theme", () => {
      const { result } = renderHook(() => useTheme());
      act(() => result.current.setTheme("graphite"));
      expect(localStorage.getItem("topos-app-theme")).toBe("graphite");
    });
  });

  describe("toggle", () => {
    it("flips from a light theme to dark", () => {
      const { result } = renderHook(() => useTheme());
      act(() => result.current.toggle());
      expect(result.current.theme).toBe("dark");
    });

    it("flips a dark-family theme back to light", () => {
      localStorage.setItem("topos-app-theme", "soft-pop");
      const { result } = renderHook(() => useTheme());
      act(() => result.current.toggle());
      expect(result.current.theme).toBe("light");
    });
  });
});
