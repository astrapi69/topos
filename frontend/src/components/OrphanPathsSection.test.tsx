import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OrphanPathsSection from "./OrphanPathsSection";
import { DialogProvider } from "./AppDialog";

const orphansMock = vi.fn();
const itemUpdateMock = vi.fn();

vi.mock("../api/client", () => ({
  api: {
    categories: {
      orphans: () => orphansMock(),
      list: vi.fn().mockResolvedValue([]),
      tree: vi.fn().mockResolvedValue([]),
    },
    items: {
      list: vi.fn().mockResolvedValue([]),
      update: (id: number, payload: unknown) => itemUpdateMock(id, payload),
    },
    containers: { list: vi.fn().mockResolvedValue([]) },
    actions: { list: vi.fn().mockResolvedValue([]) },
    i18n: { get: vi.fn().mockResolvedValue({}) },
    settings: { getApp: vi.fn().mockResolvedValue({}) },
  },
  ApiError: class extends Error {},
}));

vi.mock("../utils/backendStatus", () => ({
  isBackendAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock("../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

const REPORT = {
  orphanedItems: [
    {
      id: 42,
      content: "Alte Vertraege",
      categoryPath: "ghost/gone",
      containerId: 7,
    },
    {
      id: 43,
      content: "Belege",
      categoryPath: "ghost/gone/deeper",
      containerId: 7,
    },
  ],
  count: 2,
};

function renderSection() {
  return render(
    <MemoryRouter>
      <DialogProvider>
        <OrphanPathsSection />
      </DialogProvider>
    </MemoryRouter>,
  );
}

describe("OrphanPathsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orphansMock.mockResolvedValue(REPORT);
    itemUpdateMock.mockResolvedValue({});
  });

  it("renders one row per orphaned item with path and container link", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("orphan-paths-section")).toBeInTheDocument();
    });
    expect(screen.getByTestId("orphan-row-42")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-row-43")).toBeInTheDocument();
    expect(screen.getByText("ghost/gone")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-container-link-42")).toHaveAttribute(
      "href",
      "/containers/7",
    );
  });

  it("stays hidden when the report is unreachable (PWA mode)", async () => {
    orphansMock.mockRejectedValue(new Error("offline"));
    renderSection();
    await waitFor(() => expect(orphansMock).toHaveBeenCalled());
    expect(
      screen.queryByTestId("orphan-paths-section"),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when nothing is orphaned", async () => {
    orphansMock.mockResolvedValue({ orphanedItems: [], count: 0 });
    renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("orphan-paths-empty")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("orphan-paths-remove-all"),
    ).not.toBeInTheDocument();
  });

  it("removes a single path via items.update with null", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("orphan-row-42-remove")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("orphan-row-42-remove"));
    await waitFor(() =>
      expect(itemUpdateMock).toHaveBeenCalledWith(42, { categoryPath: null }),
    );
  });

  it("bulk-removes every path behind a confirmation dialog", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("orphan-paths-remove-all")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("orphan-paths-remove-all"));
    fireEvent.click(await screen.findByTestId("app-dialog-confirm"));

    await waitFor(() => expect(itemUpdateMock).toHaveBeenCalledTimes(2));
    expect(itemUpdateMock).toHaveBeenCalledWith(42, { categoryPath: null });
    expect(itemUpdateMock).toHaveBeenCalledWith(43, { categoryPath: null });
  });
});
