import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CategoryBrowse from "./CategoryBrowse";
import { DialogProvider } from "../components/AppDialog";
import AppFeatureProvider from "../features/AppFeatureProvider";
import { db } from "../db/schema";
import { notify } from "../utils/notify";

const treeMock = vi.fn();
const listMock = vi.fn();
const renameMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("../api/client", () => ({
  api: {
    categories: {
      tree: () => treeMock(),
      list: () => listMock(),
      rename: (id: number, path: string) => renameMock(id, path),
      delete: (id: number) => deleteMock(id),
    },
    items: { list: vi.fn().mockResolvedValue([]) },
    containers: { list: vi.fn().mockResolvedValue([]) },
    actions: { list: vi.fn().mockResolvedValue([]) },
    i18n: { get: vi.fn().mockResolvedValue({}) },
    settings: { getApp: vi.fn().mockResolvedValue({}) },
  },
  ApiError: class extends Error {},
}));

const backendAvailableMock = vi.fn();
vi.mock("../utils/backendStatus", () => ({
  isBackendAvailable: () => backendAvailableMock(),
}));

// AppFeatureProvider reads the local-vault AI state; no vault in this test.
vi.mock("../ai", () => ({
  resolveActiveProvider: () => null,
}));

vi.mock("../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

function renderPage() {
  // AppFeatureProvider drives the category-edit gate off the same mocked
  // isBackendAvailable() the page reads for its tree source.
  return render(
    <MemoryRouter>
      <AppFeatureProvider>
        <DialogProvider>
          <CategoryBrowse />
        </DialogProvider>
      </AppFeatureProvider>
    </MemoryRouter>,
  );
}

async function seedCategory() {
  await db.categories.clear();
  await db.categories.bulkPut([
    {
      id: 1,
      path: "finance",
      parentPath: null,
      name: "finance",
      displayName: "Finanzen",
      level: 0,
    },
  ]);
}

describe("CategoryBrowse", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    backendAvailableMock.mockResolvedValue(true);
    treeMock.mockResolvedValue([
      {
        path: "finance",
        name: "finance",
        displayName: "Finanzen",
        level: 0,
        children: [],
      },
    ]);
    listMock.mockResolvedValue([
      {
        id: 1,
        path: "finance",
        parentPath: null,
        name: "finance",
        displayName: "Finanzen",
        level: 0,
      },
    ]);
    renameMock.mockResolvedValue({
      renamed: true,
      itemsUpdated: 2,
      subcategoriesUpdated: 0,
      category: {
        id: 1,
        path: "money",
        parentPath: null,
        name: "money",
        displayName: "Finanzen",
        level: 0,
      },
    });
    deleteMock.mockResolvedValue({
      deleted: true,
      itemsOrphaned: 1,
      subcategoriesDeleted: 0,
    });
    await db.categories.clear();
    await db.items.clear();
  });

  it("renders the tree from the API in backend mode", async () => {
    renderPage();
    expect(screen.getByTestId("category-browse-title")).toBeInTheDocument();
    expect(screen.getByTestId("category-tree")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("category-node-finance")).toBeInTheDocument();
    });
    expect(treeMock).toHaveBeenCalled();
  });

  it("reads the tree from the Dexie cache in offline mode (no API call)", async () => {
    backendAvailableMock.mockResolvedValue(false);
    await seedCategory();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("category-node-finance")).toBeInTheDocument();
    });
    // The API tree endpoint is never called offline.
    expect(treeMock).not.toHaveBeenCalled();
  });

  it("renders an empty tree offline when the cache is empty", async () => {
    backendAvailableMock.mockResolvedValue(false);
    renderPage();
    expect(screen.getByTestId("category-tree")).toBeInTheDocument();
    await waitFor(() => expect(backendAvailableMock).toHaveBeenCalled());
    expect(
      screen.queryByTestId("category-node-finance"),
    ).not.toBeInTheDocument();
    expect(treeMock).not.toHaveBeenCalled();
  });

  it("hides rename and delete actions in offline mode", async () => {
    backendAvailableMock.mockResolvedValue(false);
    await seedCategory();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("category-node-finance")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("category-rename-finance"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("category-delete-finance"),
    ).not.toBeInTheDocument();
  });

  it("renames a category through the prompt dialog and reports the cascade", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("category-rename-finance")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("category-rename-finance"));

    const pathInput = await screen.findByRole("textbox");
    expect((pathInput as HTMLInputElement).value).toBe("finance");
    fireEvent.change(pathInput, { target: { value: "money" } });
    fireEvent.click(screen.getByTestId("app-dialog-confirm"));

    await waitFor(() => expect(renameMock).toHaveBeenCalledWith(1, "money"));
    await waitFor(() => expect(notify.success).toHaveBeenCalled());
    const message = vi.mocked(notify.success).mock.calls[0][0];
    expect(String(message)).toContain("2");
  });

  it("deletes a category behind a confirmation dialog", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("category-delete-finance")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("category-delete-finance"));

    fireEvent.click(await screen.findByTestId("app-dialog-confirm"));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(notify.success).toHaveBeenCalled());
  });
});
