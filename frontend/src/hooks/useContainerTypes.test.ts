/**
 * The Settings toggle for container types is a UI visibility filter,
 * never a data rule: storage and API accept every enum value at all
 * times. These pins define the filter's contract - defaults always on,
 * extras opt-in and persisted, unknown stored junk ignored.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useContainerTypes } from "./useContainerTypes";

describe("useContainerTypes", () => {
  beforeEach(() => localStorage.clear());

  it("offers folder and box out of the box", () => {
    const { result } = renderHook(() => useContainerTypes());
    expect(result.current.enabled).toEqual(["folder", "box"]);
  });

  it("enables an optional type and persists the choice", () => {
    const first = renderHook(() => useContainerTypes());
    act(() => first.result.current.setTypeEnabled("drawer", true));
    expect(first.result.current.enabled).toContain("drawer");
    first.unmount();

    // A fresh mount (new page) reads the persisted choice.
    const second = renderHook(() => useContainerTypes());
    expect(second.result.current.enabled).toContain("drawer");
  });

  it("keeps the curated enum order regardless of toggle order", () => {
    const { result } = renderHook(() => useContainerTypes());
    act(() => result.current.setTypeEnabled("safe", true));
    act(() => result.current.setTypeEnabled("drawer", true));
    expect(result.current.enabled).toEqual(["folder", "box", "drawer", "safe"]);
  });

  it("cannot disable the defaults", () => {
    const { result } = renderHook(() => useContainerTypes());
    act(() => result.current.setTypeEnabled("folder", false));
    expect(result.current.enabled).toContain("folder");
  });

  it("ignores junk in the stored value", () => {
    // A stale or hand-edited entry must not leak an invalid type into
    // the forms - the forms feed values straight into create payloads.
    localStorage.setItem(
      "topos.container_types",
      JSON.stringify(["drawer", "spaceship", 42]),
    );
    const { result } = renderHook(() => useContainerTypes());
    expect(result.current.enabled).toEqual(["folder", "box", "drawer"]);
  });
});
