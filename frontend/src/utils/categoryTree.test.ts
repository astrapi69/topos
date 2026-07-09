import {describe, expect, it} from "vitest";

import {buildCategoryTree} from "./categoryTree";
import type {Category} from "../types/topos";

function cat(partial: Partial<Category> & {path: string}): Category {
    return {
        id: 0,
        parentPath: null,
        name: partial.path.split("/").at(-1) ?? partial.path,
        displayName: partial.path,
        level: partial.path.split("/").length - 1,
        ...partial,
    };
}

describe("buildCategoryTree", () => {
    it("returns an empty forest for no rows", () => {
        expect(buildCategoryTree([])).toEqual([]);
    });

    it("nests children under their parent (happy path)", () => {
        const flat: Category[] = [
            cat({id: 1, path: "finance", parentPath: null, name: "finance", displayName: "Finanzen", level: 0}),
            cat({id: 2, path: "finance/bank", parentPath: "finance", name: "bank", displayName: "Bank", level: 1}),
            cat({id: 3, path: "finance/insurance", parentPath: "finance", name: "insurance", displayName: "Versicherung", level: 1}),
        ];
        const forest = buildCategoryTree(flat);
        expect(forest).toHaveLength(1);
        expect(forest[0].path).toBe("finance");
        expect(forest[0].children.map((c) => c.path)).toEqual([
            "finance/bank",
            "finance/insurance",
        ]);
    });

    it("produces multiple roots for top-level siblings", () => {
        const flat: Category[] = [
            cat({id: 1, path: "finance", parentPath: null, level: 0}),
            cat({id: 2, path: "archive", parentPath: null, level: 0}),
        ];
        const forest = buildCategoryTree(flat);
        expect(forest.map((n) => n.path)).toEqual(["archive", "finance"]);
    });

    it("treats a row whose parent is missing as a root (edge case)", () => {
        const flat: Category[] = [
            cat({id: 1, path: "orphan/child", parentPath: "orphan", level: 1}),
        ];
        const forest = buildCategoryTree(flat);
        expect(forest).toHaveLength(1);
        expect(forest[0].path).toBe("orphan/child");
        expect(forest[0].children).toEqual([]);
    });

    it("orders output by path regardless of input order (boundary)", () => {
        const flat: Category[] = [
            cat({id: 3, path: "finance/insurance", parentPath: "finance", level: 1}),
            cat({id: 1, path: "finance", parentPath: null, level: 0}),
            cat({id: 2, path: "finance/bank", parentPath: "finance", level: 1}),
        ];
        const forest = buildCategoryTree(flat);
        expect(forest[0].path).toBe("finance");
        expect(forest[0].children.map((c) => c.path)).toEqual([
            "finance/bank",
            "finance/insurance",
        ]);
    });
});
