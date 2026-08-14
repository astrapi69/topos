/**
 * The tree's move surfaces. The drag gesture itself is not unit-testable
 * (pointer-event choreography; covered by the smoke spec and the rules'
 * own tests in treeMove.test.ts) - what these pins cover is the
 * "Verschieben nach..." button: it exists exactly on movable rows, its
 * dialog offers only canDrop-approved targets, and a pick ends in the
 * storage write plus the onMoved refresh.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InventoryTreeView from "./InventoryTreeView";
import type { Container, Item } from "../types/topos";

const mocks = vi.hoisted(() => ({
  choose: vi.fn(),
  containersUpdate: vi.fn(async () => ({})),
  itemsUpdate: vi.fn(async () => ({})),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k, lang: "de" }),
}));
vi.mock("./AppDialog", () => ({
  useDialog: () => ({
    choose: mocks.choose,
    confirm: vi.fn(),
    prompt: vi.fn(),
    alert: vi.fn(),
  }),
}));
vi.mock("../storage", () => ({
  getStorage: () => ({
    containers: { update: mocks.containersUpdate },
    items: { update: mocks.itemsUpdate },
  }),
}));
vi.mock("../utils/notify", () => ({
  notify: {
    success: mocks.success,
    error: mocks.error,
    warning: mocks.warning,
  },
  errorMessage: (_e: unknown, fb: string) => fb,
}));

function container(
  id: number,
  externalId: number,
  label: string,
  parentContainerId: number | null = null,
): Container {
  return {
    id,
    externalId,
    label,
    type: "folder",
    owner: "self",
    description: null,
    location: null,
    sizeGroup: null,
    parentContainerId,
    createdAt: "",
    updatedAt: "",
  };
}

const ITEM: Item = {
  id: 10,
  containerId: 1,
  externalId: 1,
  content: "Police",
  priority: "none",
  categoryPath: null,
  notes: null,
  createdAt: "",
  updatedAt: "",
};

function renderTree(onMoved = vi.fn()) {
  render(
    <MemoryRouter>
      <InventoryTreeView
        containers={[container(1, 42, "Quelle"), container(2, 43, "Ziel")]}
        items={[ITEM]}
        onMoved={onMoved}
      />
    </MemoryRouter>,
  );
  return onMoved;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("InventoryTreeView move button", () => {
  it("renders on containers, not on groups or the root", () => {
    renderTree();
    expect(screen.getByTestId("tree-move-container:1")).toBeInTheDocument();
    expect(screen.queryByTestId("tree-move-root")).toBeNull();
    expect(screen.queryByTestId("tree-move-group:folder:self")).toBeNull();
  });

  it("moves an item to the picked container and refreshes", async () => {
    mocks.choose.mockResolvedValue("container:2");
    const onMoved = renderTree();

    // Items are under a collapsed container; expand first.
    fireEvent.click(screen.getByTestId("tree-toggle-container:1"));
    fireEvent.click(screen.getByTestId("tree-move-item:10"));

    await waitFor(() =>
      expect(mocks.itemsUpdate).toHaveBeenCalledWith(10, { containerId: 2 }),
    );
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(mocks.success).toHaveBeenCalled();
  });

  it("offers an item only foreign containers, no groups", async () => {
    mocks.choose.mockResolvedValue(null);
    renderTree();

    fireEvent.click(screen.getByTestId("tree-toggle-container:1"));
    fireEvent.click(screen.getByTestId("tree-move-item:10"));

    await waitFor(() => expect(mocks.choose).toHaveBeenCalled());
    const values = (
      mocks.choose.mock.calls[0][2] as Array<{ value: string }>
    ).map((choice) => choice.value);
    // Its own container (1) is a no-op and must not be offered.
    expect(values).toEqual(["container:2"]);
  });

  it("nests a container into the picked container", async () => {
    mocks.choose.mockResolvedValue("container:2");
    renderTree();

    fireEvent.click(screen.getByTestId("tree-move-container:1"));

    await waitFor(() =>
      expect(mocks.containersUpdate).toHaveBeenCalledWith(1, {
        parentContainerId: 2,
      }),
    );
  });

  it("offers detach only to a nested container", async () => {
    mocks.choose.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <InventoryTreeView
          containers={[container(1, 42, "Regal"), container(2, 43, "Drin", 1)]}
          items={[]}
        />
      </MemoryRouter>,
    );

    // Nested container: root option present.
    fireEvent.click(screen.getByTestId("tree-toggle-container:1"));
    fireEvent.click(screen.getByTestId("tree-move-container:2"));
    await waitFor(() => expect(mocks.choose).toHaveBeenCalled());
    const nestedValues = (
      mocks.choose.mock.calls[0][2] as Array<{ value: string }>
    ).map((choice) => choice.value);
    expect(nestedValues).toContain("root");

    // Top-level container: no root option.
    mocks.choose.mockClear();
    mocks.choose.mockResolvedValue(null);
    fireEvent.click(screen.getByTestId("tree-move-container:1"));
    await waitFor(() => expect(mocks.choose).toHaveBeenCalled());
    const topValues = (
      mocks.choose.mock.calls[0][2] as Array<{ value: string }>
    ).map((choice) => choice.value);
    expect(topValues).not.toContain("root");
  });
});
