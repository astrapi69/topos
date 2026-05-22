import {describe, expect, it} from "vitest";

import {_internal} from "./client";

const {camelizeKeys, snakeizeKeys, snakeToCamel, camelToSnake} = _internal;

describe("api/client snake_case <-> camelCase", () => {
    it("converts simple snake_case keys", () => {
        expect(snakeToCamel("external_id")).toBe("externalId");
        expect(snakeToCamel("category_path")).toBe("categoryPath");
        expect(snakeToCamel("already_camelCase")).toBe("alreadyCamelCase");
    });

    it("converts camelCase back to snake_case", () => {
        expect(camelToSnake("externalId")).toBe("external_id");
        expect(camelToSnake("alreadySnake")).toBe("already_snake");
    });

    it("camelizes nested dict keys", () => {
        const input = {
            container_id: 1,
            nested: {child_path: "finance", level: 0},
            list: [{action_text: "x"}],
        };
        expect(camelizeKeys(input)).toEqual({
            containerId: 1,
            nested: {childPath: "finance", level: 0},
            list: [{actionText: "x"}],
        });
    });

    it("snakeizes nested dict keys", () => {
        const input = {
            externalId: 1,
            sizeGroup: "a",
            nested: {parentPath: "p"},
        };
        expect(snakeizeKeys(input)).toEqual({
            external_id: 1,
            size_group: "a",
            nested: {parent_path: "p"},
        });
    });

    it("leaves primitives and Date strings alone", () => {
        expect(camelizeKeys(42)).toBe(42);
        expect(camelizeKeys("hello")).toBe("hello");
        expect(camelizeKeys(null)).toBe(null);
    });
});
