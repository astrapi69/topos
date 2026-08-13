import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DataSection from "./DataSection";

const mocks = vi.hoisted(() => ({
  exportToposData: vi.fn(),
  downloadBackup: vi.fn(),
  downloadExcelBackup: vi.fn(),
  importToposData: vi.fn(),
  readBackupFile: vi.fn(),
  importWorkbook: vi.fn(),
  apiImportExcel: vi.fn(),
  featureActive: { value: false },
  promptMock: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("../backup", () => ({
  exportToposData: mocks.exportToposData,
  downloadBackup: mocks.downloadBackup,
  downloadExcelBackup: mocks.downloadExcelBackup,
  importToposData: mocks.importToposData,
  readBackupFile: mocks.readBackupFile,
  BackupValidationError: class extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
vi.mock("../excel/importWorkbook", () => ({
  importWorkbook: mocks.importWorkbook,
}));
vi.mock("../api/client", () => ({
  api: { importExcel: mocks.apiImportExcel },
}));
vi.mock("@astrapi69/feature-strategy-react", () => ({
  useFeature: () => ({ isActive: mocks.featureActive.value }),
}));
vi.mock("../storage", () => ({ getStorage: () => ({}) }));
vi.mock("../hooks/useTopos", () => ({ refreshAll: vi.fn(async () => {}) }));
vi.mock("../search/buildIndex", () => ({
  rebuildSearchIndex: vi.fn(async () => {}),
}));
vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k, lang: "en" }),
}));
vi.mock("./AppDialog", () => ({
  useDialog: () => ({
    prompt: mocks.promptMock,
    confirm: vi.fn(),
    alert: vi.fn(),
    choose: vi.fn(),
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

const BACKUP = {
  format: "topos-backup",
  version: 1,
  source: "dexie",
  stats: { containers: 2, items: 5, categories: 1, actions: 0 },
  data: {},
};

beforeEach(() => vi.clearAllMocks());

describe("DataSection", () => {
  it("renders export and import buttons", () => {
    render(<DataSection />);
    expect(screen.getByTestId("data-export")).toBeInTheDocument();
    expect(screen.getByTestId("data-export-excel")).toBeInTheDocument();
    expect(screen.getByTestId("data-import")).toBeInTheDocument();
  });

  it("routes a picked xlsx through the Excel importer, not the backup parser", async () => {
    // Reported from an iPhone: picking the Excel export here answered
    // "Ungueltige Backup-Datei". The picker is shared, the content is
    // unmistakable (xlsx is a ZIP, PK\x03\x04), so the section dispatches
    // on the magic bytes instead of telling the user they chose the wrong
    // page.
    const EMPTY_REPORT = {
      containersCreated: 1,
      containersUpdated: 0,
      itemsCreated: 2,
      itemsUpdated: 0,
      itemsPruned: 0,
      actionsCreated: 0,
      categoriesCreated: 0,
      warnings: [],
    };
    mocks.importWorkbook.mockResolvedValue(EMPTY_REPORT);
    render(<DataSection />);

    const xlsx = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])],
      "export.xlsx",
    );
    fireEvent.change(screen.getByTestId("data-import-input"), {
      target: { files: [xlsx] },
    });

    await waitFor(() => expect(mocks.importWorkbook).toHaveBeenCalledTimes(1));
    expect(mocks.readBackupFile).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it("posts the xlsx to the backend when the excel-import feature is active", async () => {
    mocks.featureActive.value = true;
    mocks.apiImportExcel.mockResolvedValue({
      containersCreated: 0,
      containersUpdated: 1,
      itemsCreated: 0,
      itemsUpdated: 3,
      itemsPruned: 0,
      actionsCreated: 0,
      categoriesCreated: 0,
      warnings: [],
    });
    render(<DataSection />);

    const xlsx = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])],
      "export.xlsx",
    );
    fireEvent.change(screen.getByTestId("data-import-input"), {
      target: { files: [xlsx] },
    });

    await waitFor(() => expect(mocks.apiImportExcel).toHaveBeenCalledTimes(1));
    expect(mocks.importWorkbook).not.toHaveBeenCalled();
    mocks.featureActive.value = false;
  });

  it("still parses a JSON pick as a backup", async () => {
    mocks.readBackupFile.mockResolvedValue(BACKUP);
    render(<DataSection />);

    const json = new File(['{"format":"topos-backup"}'], "backup.topos.json");
    fireEvent.change(screen.getByTestId("data-import-input"), {
      target: { files: [json] },
    });

    await waitFor(() => expect(mocks.readBackupFile).toHaveBeenCalledTimes(1));
    expect(mocks.importWorkbook).not.toHaveBeenCalled();
  });

  it("does not filter the restore picker by type (iOS greys out real files)", () => {
    // Same failure mode as the Import page: iOS filters the picker by UTI
    // derived from the file NAME, so a backup that lost its extension in
    // transit is unselectable even though its content is fine. The restore
    // validates the envelope and reports precisely, so the filter added no
    // safety.
    render(<DataSection />);
    expect(screen.getByTestId("data-import-input")).not.toHaveAttribute(
      "accept",
    );
  });

  it("exports and downloads on click", async () => {
    mocks.exportToposData.mockResolvedValue(BACKUP);
    render(<DataSection />);
    fireEvent.click(screen.getByTestId("data-export"));
    await waitFor(() =>
      expect(mocks.downloadBackup).toHaveBeenCalledWith(BACKUP),
    );
    expect(mocks.success).toHaveBeenCalled();
  });

  it("exports Excel from the same backup snapshot", async () => {
    mocks.exportToposData.mockResolvedValue(BACKUP);
    render(<DataSection />);
    fireEvent.click(screen.getByTestId("data-export-excel"));
    await waitFor(() =>
      expect(mocks.downloadExcelBackup).toHaveBeenCalledWith(BACKUP),
    );
    expect(mocks.success).toHaveBeenCalled();
  });

  it("shows a preview after picking a valid file, then merges", async () => {
    mocks.readBackupFile.mockResolvedValue(BACKUP);
    mocks.importToposData.mockResolvedValue({ imported: 8, skipped: 0 });
    render(<DataSection />);

    const file = new File(["{}"], "b.topos.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("data-import-input"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("data-import-preview")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("data-import-source").textContent).toBe("dexie");

    fireEvent.click(screen.getByTestId("data-import-merge"));
    await waitFor(() =>
      expect(mocks.importToposData).toHaveBeenCalledWith(BACKUP, "merge"),
    );
  });

  it("requires the typed keyword before replacing", async () => {
    mocks.readBackupFile.mockResolvedValue(BACKUP);
    mocks.importToposData.mockResolvedValue({ imported: 8, skipped: 0 });
    mocks.promptMock.mockResolvedValue("ersetzen"); // case-insensitive match of the fallback keyword
    render(<DataSection />);

    const file = new File(["{}"], "b.topos.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("data-import-input"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(screen.getByTestId("data-import-replace")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId("data-import-replace"));
    await waitFor(() =>
      expect(mocks.importToposData).toHaveBeenCalledWith(BACKUP, "replace"),
    );
  });
});
