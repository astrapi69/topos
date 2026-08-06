import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Import from "./Import";
import { DialogProvider } from "../components/AppDialog";
import { TestFeatureProvider } from "../features/testFeatureProvider";
import type { FeatureContext } from "../features/featureConfig";

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

  it("disables submit and shows a hint when no backend is reachable", () => {
    // excel-import is backend-required: offline the button stays disabled
    // and the hint explains why (previously the button was enabled and the
    // POST failed with only a toast).
    renderImport({ backendAvailable: false, hasAiKey: false });
    expect(screen.getByTestId("import-submit")).toBeDisabled();
    expect(screen.getByTestId("import-backend-hint")).toBeInTheDocument();
  });
});
