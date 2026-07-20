import {describe, expect, it} from "vitest";

import {buildCategoryTree} from "./categoryTree";
import type {Category} from "../types/topos";

function cat(path: string, parentPath: string | null, level: number): Category {
    return {id: path.length, path, parentPath, name: path.split("/").pop() ?? path, displayName: path, level};
}

describe("buildCategoryTree", () => {
    it("nests children under their parent", () => {
        const tree = buildCategoryTree([
            cat("finance", null, 0),
            cat("finance/bank", "finance", 1),
            cat("tools", null, 0),
        ]);
        expect(tree.map((n) => n.path)).toEqual(["finance", "tools"]);
        const finance = tree.find((n) => n.path === "finance")!;
        expect(finance.children.map((c) => c.path)).toEqual(["finance/bank"]);
    });

    it("treats a row with a missing parent as a root (orphan-safe)", () => {
        const tree = buildCategoryTree([cat("a/b", "a", 1)]);
        expect(tree.map((n) => n.path)).toEqual(["a/b"]);
    });

    it("returns an empty array for empty input", () => {
        expect(buildCategoryTree([])).toEqual([]);
    });

    it("orders siblings by path", () => {
        const tree = buildCategoryTree([cat("z", null, 0), cat("a", null, 0), cat("m", null, 0)]);
        expect(tree.map((n) => n.path)).toEqual(["a", "m", "z"]);
    });
});
