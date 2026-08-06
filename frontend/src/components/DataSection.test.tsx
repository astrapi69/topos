import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import DataSection from "./DataSection";

const mocks = vi.hoisted(() => ({
    exportToposData: vi.fn(),
    downloadBackup: vi.fn(),
    importToposData: vi.fn(),
    readBackupFile: vi.fn(),
    promptMock: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
}));

vi.mock("../backup", () => ({
    exportToposData: mocks.exportToposData,
    downloadBackup: mocks.downloadBackup,
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
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k, lang: "en"}),
}));
vi.mock("./AppDialog", () => ({
    useDialog: () => ({prompt: mocks.promptMock, confirm: vi.fn(), alert: vi.fn(), choose: vi.fn()}),
}));
vi.mock("../utils/notify", () => ({
    notify: {success: mocks.success, error: mocks.error, warning: mocks.warning},
    errorMessage: (_e: unknown, fb: string) => fb,
}));

const BACKUP = {
    format: "topos-backup",
    version: 1,
    source: "dexie",
    stats: {containers: 2, items: 5, categories: 1, actions: 0},
    data: {},
};

beforeEach(() => vi.clearAllMocks());

describe("DataSection", () => {
    it("renders export and import buttons", () => {
        render(<DataSection />);
        expect(screen.getByTestId("data-export")).toBeInTheDocument();
        expect(screen.getByTestId("data-import")).toBeInTheDocument();
    });

    it("exports and downloads on click", async () => {
        mocks.exportToposData.mockResolvedValue(BACKUP);
        render(<DataSection />);
        fireEvent.click(screen.getByTestId("data-export"));
        await waitFor(() => expect(mocks.downloadBackup).toHaveBeenCalledWith(BACKUP));
        expect(mocks.success).toHaveBeenCalled();
    });

    it("shows a preview after picking a valid file, then merges", async () => {
        mocks.readBackupFile.mockResolvedValue(BACKUP);
        mocks.importToposData.mockResolvedValue({imported: 8, skipped: 0});
        render(<DataSection />);

        const file = new File(["{}"], "b.topos.json", {type: "application/json"});
        fireEvent.change(screen.getByTestId("data-import-input"), {target: {files: [file]}});

        await waitFor(() => expect(screen.getByTestId("data-import-preview")).toBeInTheDocument());
        expect(screen.getByTestId("data-import-source").textContent).toBe("dexie");

        fireEvent.click(screen.getByTestId("data-import-merge"));
        await waitFor(() => expect(mocks.importToposData).toHaveBeenCalledWith(BACKUP, "merge"));
    });

    it("requires the typed keyword before replacing", async () => {
        mocks.readBackupFile.mockResolvedValue(BACKUP);
        mocks.importToposData.mockResolvedValue({imported: 8, skipped: 0});
        mocks.promptMock.mockResolvedValue("ersetzen"); // case-insensitive match of the fallback keyword
        render(<DataSection />);

        const file = new File(["{}"], "b.topos.json", {type: "application/json"});
        fireEvent.change(screen.getByTestId("data-import-input"), {target: {files: [file]}});
        await waitFor(() => expect(screen.getByTestId("data-import-replace")).toBeInTheDocument());

        fireEvent.click(screen.getByTestId("data-import-replace"));
        await waitFor(() => expect(mocks.importToposData).toHaveBeenCalledWith(BACKUP, "replace"));
    });
});
