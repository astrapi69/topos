/**
 * The tree view renders the inventory forest: groups open, containers
 * closed until clicked (a folder's contents are detail, not overview),
 * every node routable - a container chevron expands, its label navigates.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { Container, Item } from "../types/topos";
import InventoryTreeView from "./InventoryTreeView";

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "de",
    setLang: vi.fn(),
  }),
}));

const CONTAINERS: Container[] = [
  {
    id: 1,
    externalId: 42,
    label: "Versicherungen",
    type: "folder",
    owner: "self",
    description: null,
    location: null,
    sizeGroup: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

const ITEMS: Item[] = [
  {
    id: 10,
    containerId: 1,
    externalId: 1,
    content: "Hausrat - Police",
    priority: "none",
    categoryPath: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

function renderTree() {
  return render(
    <MemoryRouter>
      <InventoryTreeView containers={CONTAINERS} items={ITEMS} />
    </MemoryRouter>,
  );
}

describe("InventoryTreeView", () => {
  it("shows the app root, groups and containers, but not items, initially", () => {
    renderTree();
    expect(screen.getByTestId("tree-node-root").textContent).toContain("Topos");
    expect(screen.getByText(/Versicherungen/)).toBeTruthy();
    expect(screen.queryByText(/Hausrat/)).toBeNull();
  });

  it("expands a container's items on toggle", () => {
    renderTree();
    fireEvent.click(screen.getByTestId("tree-toggle-container:1"));
    expect(screen.getByText(/Hausrat/)).toBeTruthy();
    expect(screen.getByText("42-1")).toBeTruthy();
  });

  it("links the container label to its detail page", () => {
    renderTree();
    const label = screen.getByTestId("tree-link-container:1");
    expect(label.getAttribute("href")).toBe("/containers/1");
  });

  it("links an expanded item to its editor", () => {
    renderTree();
    fireEvent.click(screen.getByTestId("tree-toggle-container:1"));
    const leaf = screen.getByTestId("tree-link-item:10");
    expect(leaf.getAttribute("href")).toBe("/items/10");
  });

  it("shows the subtree item count on the group", () => {
    renderTree();
    expect(
      screen.getByTestId("tree-node-group:folder:self").textContent,
    ).toContain("(1)");
  });
});
