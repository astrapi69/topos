import {describe, expect, it} from "vitest";

import {parseItemsPayload} from "./visionParsing";

const ROW = {
    label: "Bohrmaschine",
    category_path: "tools",
    new_category_hint: "",
    description: "Akku-Bohrmaschine",
    confidence: 0.9,
};

describe("parseItemsPayload", () => {
    it("parses an items object into camelCase rows", () => {
        expect(parseItemsPayload({items: [ROW]})).toEqual([
            {
                label: "Bohrmaschine",
                categoryPath: "tools",
                newCategoryHint: "",
                description: "Akku-Bohrmaschine",
                confidence: 0.9,
            },
        ]);
    });

    it("accepts a bare array and a JSON string", () => {
        expect(parseItemsPayload([ROW])).toHaveLength(1);
        expect(parseItemsPayload(JSON.stringify({items: [ROW]}))).toHaveLength(1);
    });

    it("strips markdown fences before decoding", () => {
        const fenced = "```json\n" + JSON.stringify({items: [ROW]}) + "\n```";
        expect(parseItemsPayload(fenced)).toHaveLength(1);
    });

    it("extracts the first JSON fragment out of surrounding prose", () => {
        const prose = `Here is what I found: ${JSON.stringify({items: [ROW]})} Hope it helps!`;
        expect(parseItemsPayload(prose)).toHaveLength(1);
    });

    it("skips malformed entries instead of failing the whole result", () => {
        const rows = parseItemsPayload({
            items: [ROW, {label: "   "}, "not-an-object", {description: "no label"}],
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].label).toBe("Bohrmaschine");
    });

    it("clamps and defaults the confidence", () => {
        const rows = parseItemsPayload({
            items: [
                {label: "A", confidence: 1.7},
                {label: "B", confidence: -3},
                {label: "C", confidence: "0.5"},
                {label: "D", confidence: "kaputt"},
                {label: "E"},
            ],
        });
        expect(rows.map((row) => row.confidence)).toEqual([1, 0, 0.5, 0, 0]);
    });

    it("defaults missing string fields to empty strings", () => {
        expect(parseItemsPayload({items: [{label: "Nur Label"}]})[0]).toEqual({
            label: "Nur Label",
            categoryPath: "",
            newCategoryHint: "",
            description: "",
            confidence: 0,
        });
    });

    it("throws when the payload carries no item list", () => {
        expect(() => parseItemsPayload({nope: true})).toThrow(/no item list/);
        expect(() => parseItemsPayload(42)).toThrow(/no item list/);
    });

    it("throws when a string carries no JSON at all", () => {
        expect(() => parseItemsPayload("sorry, I cannot see any items")).toThrow(
            /no JSON/,
        );
    });
});
