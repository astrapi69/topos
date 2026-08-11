import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Import from "./Import";
import { api } from "../api/client";
import { DialogProvider } from "../components/AppDialog";
import { TestFeatureProvider } from "../features/testFeatureProvider";
import type { FeatureContext } from "../features/featureConfig";

const importWorkbookMock = vi.fn(async () => ({
  containersCreated: 1,
  containersUpdated: 0,
  itemsCreated: 2,
  itemsUpdated: 0,
  itemsPruned: 0,
  actionsCreated: 0,
  categoriesCreated: 1,
  warnings: [],
}));

vi.mock("../excel/importWorkbook", () => ({
  importWorkbook: () => importWorkbookMock(),
}));

vi.mock("../storage", () => ({
  getStorage: () => ({ mode: "dexie" }),
}));

vi.mock("../hooks/useTopos", () => ({ refreshAll: vi.fn(async () => {}) }));

vi.mock("../search/buildIndex", () => ({
  rebuildSearchIndex: vi.fn(async () => {}),
}));

vi.mock("../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("../api/client", () => ({
  api: {
    importExcel: vi.fn().mockResolvedValue({
      containersCreated: 0,
      containersUpdated: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsPruned: 0,
      actionsCreated: 0,
      categoriesCreated: 0,
      warnings: [],
    }),
    containers: { list: vi.fn().mockResolvedValue([]) },
    items: { list: vi.fn().mockResolvedValue([]) },
    categories: { list: vi.fn().mockResolvedValue([]) },
    actions: { list: vi.fn().mockResolvedValue([]) },
    i18n: { get: vi.fn().mockResolvedValue({}) },
    settings: { getApp: vi.fn().mockResolvedValue({}) },
  },
  ApiError: class extends Error {},
}));

function renderImport(context: FeatureContext) {
  return render(
    <MemoryRouter>
      <TestFeatureProvider context={context}>
        <DialogProvider>
          <Import />
        </DialogProvider>
      </TestFeatureProvider>
    </MemoryRouter>,
  );
}

describe("Import", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the upload form", () => {
    renderImport({ backendAvailable: true, hasAiKey: false });
    expect(screen.getByTestId("import-title")).toBeInTheDocument();
    expect(screen.getByTestId("import-form")).toBeInTheDocument();
    expect(screen.getByTestId("import-dropzone")).toBeInTheDocument();
    expect(screen.getByTestId("import-submit")).toBeDisabled();
  });

  it("shows no backend hint when the backend is reachable", () => {
    renderImport({ backendAvailable: true, hasAiKey: false });
    expect(screen.queryByTestId("import-backend-hint")).not.toBeInTheDocument();
  });

  it("keeps the import usable without a backend (offline parser)", async () => {
    // Excel import is no longer backend-required: without a backend the
    // workbook is parsed in the browser and written through the storage
    // service, so the button stays usable and no hint claims otherwise.
    renderImport({ backendAvailable: false, hasAiKey: false });
    expect(screen.queryByTestId("import-backend-hint")).not.toBeInTheDocument();

    const fileInput = screen.getByTestId("import-file-input");
    fireEvent.change(fileInput, {
      target: { files: [new File(["x"], "Ordner-Ordnung.xlsx")] },
    });
    const submit = screen.getByTestId("import-submit");
    await waitFor(() => expect(submit).not.toBeDisabled());

    fireEvent.submit(screen.getByTestId("import-form"));
    // Offline path: the local importer runs, the backend is never called.
    await waitFor(() => expect(importWorkbookMock).toHaveBeenCalled());
    expect(api.importExcel).not.toHaveBeenCalled();
    expect(await screen.findByTestId("import-report")).toBeInTheDocument();
  });

  it("posts to the backend when one is reachable", async () => {
    renderImport({ backendAvailable: true, hasAiKey: false });
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File(["x"], "Ordner-Ordnung.xlsx")] },
    });
    fireEvent.submit(screen.getByTestId("import-form"));

    await waitFor(() => expect(api.importExcel).toHaveBeenCalled());
    expect(importWorkbookMock).not.toHaveBeenCalled();
  });
});
