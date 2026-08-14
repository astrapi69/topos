/**
 * The inventory tree is the shape the Excel workbook always had: its three
 * sheets are not arbitrary tabs but (type, owner) pairs - "Meine Ordner" is
 * folder/self, "Ordner Eltern" is folder/parents, "Boxen" is box/self. So the
 * data is a three-level forest already: group -> container -> item.
 *
 * The groups are derived from the rows, never hardcoded to those three. A
 * shared folder, or a box that belongs to the parents, is a legitimate
 * combination the workbook has no sheet for; hardcoding would make such a
 * container vanish from the only view that claims to show everything.
 */

import { describe, expect, it } from "vitest";

import type { Container, Item } from "../types/topos";
import { buildInventoryTree, groupKeyOf } from "./inventoryTree";

/** Every tree hangs off the single app root; tests read groups from it. */
function groupsOf(root: ReturnType<typeof buildInventoryTree>) {
  return root.children;
}

function container(
  id: number,
  externalId: number,
  label: string,
  type: Container["type"] = "folder",
  owner: Container["owner"] = "self",
  parentContainerId: number | null = null,
): Container {
  return {
    id,
    externalId,
    label,
    type,
    owner,
    description: null,
    location: null,
    sizeGroup: null,
    parentContainerId,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function item(
  id: number,
  containerId: number,
  content: string,
  externalId = 1,
): Item {
  return {
    id,
    containerId,
    externalId,
    content,
    priority: "none",
    categoryPath: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("buildInventoryTree", () => {
  it("puts the app itself at the root", () => {
    const root = buildInventoryTree([container(1, 42, "Versicherungen")], []);
    expect(root.kind).toBe("root");
    expect(root.label).toBe("Topos");
    expect(root.children.every((group) => group.kind === "group")).toBe(true);
  });

  it("nests items under their container, and containers under their group", () => {
    const root = buildInventoryTree(
      [container(1, 42, "Versicherungen")],
      [item(10, 1, "Hausrat"), item(11, 1, "Haftpflicht", 2)],
    );
    const forest = groupsOf(root);

    expect(forest).toHaveLength(1);
    const [group] = forest;
    expect(group.kind).toBe("group");
    expect(group.children).toHaveLength(1);

    const [folder] = group.children;
    expect(folder.kind).toBe("container");
    expect(folder.children.map((leaf) => leaf.label)).toEqual([
      "Hausrat",
      "Haftpflicht",
    ]);
    expect(folder.children.every((leaf) => leaf.kind === "item")).toBe(true);
  });

  it("splits the three workbook sheets into their own groups", () => {
    const forest = groupsOf(
      buildInventoryTree(
        [
          container(1, 42, "Versicherungen", "folder", "self"),
          container(2, 5, "Eltern-Ordner", "folder", "parents"),
          container(3, 9, "Kiste", "box", "self"),
        ],
        [],
      ),
    );

    expect(forest.map((group) => group.id).sort()).toEqual(
      ["group:box:self", "group:folder:parents", "group:folder:self"].sort(),
    );
  });

  it("derives a group for a combination the workbook has no sheet for", () => {
    // box + parents is not one of the three sheets, but the model allows it.
    const forest = groupsOf(
      buildInventoryTree(
        [container(1, 3, "Geteilte Kiste", "box", "shared")],
        [],
      ),
    );

    expect(forest).toHaveLength(1);
    expect(forest[0].id).toBe(groupKeyOf("box", "shared"));
    expect(forest[0].children[0].label).toContain("Geteilte Kiste");
  });

  it("keeps an empty container visible", () => {
    // An empty folder is a real thing to see - it is where the next entry goes.
    const forest = groupsOf(buildInventoryTree([container(1, 42, "Leer")], []));
    expect(forest[0].children[0].children).toEqual([]);
  });

  it("counts items per subtree, not per level", () => {
    const root = buildInventoryTree(
      [container(1, 42, "A"), container(2, 43, "B")],
      [item(10, 1, "x"), item(11, 1, "y", 2), item(12, 2, "z")],
    );

    // The root count is the whole inventory.
    expect(root.itemCount).toBe(3);
    expect(groupsOf(root)[0].itemCount).toBe(3);
    expect(groupsOf(root)[0].children.map((node) => node.itemCount)).toEqual([
      2, 1,
    ]);
  });

  it("orders containers by their user-facing number", () => {
    const forest = groupsOf(
      buildInventoryTree(
        [
          container(1, 43, "spaeter"),
          container(2, 7, "frueher"),
          container(3, 42, "mitte"),
        ],
        [],
      ),
    );
    expect(forest[0].children.map((node) => node.label)).toEqual([
      "frueher",
      "mitte",
      "spaeter",
    ]);
  });

  it("orders items by their number within the container", () => {
    const forest = groupsOf(
      buildInventoryTree(
        [container(1, 42, "A")],
        [
          item(10, 1, "dritter", 3),
          item(11, 1, "erster", 1),
          item(12, 1, "zweiter", 2),
        ],
      ),
    );
    expect(forest[0].children[0].children.map((leaf) => leaf.label)).toEqual([
      "erster",
      "zweiter",
      "dritter",
    ]);
  });

  it("nests a container under its parent container", () => {
    const root = buildInventoryTree(
      [
        container(1, 10, "Regal", "shelf", "self"),
        container(2, 11, "Ordner im Regal", "folder", "self", 1),
      ],
      [item(20, 2, "Police")],
    );
    const shelfGroup = groupsOf(root).find(
      (group) => group.id === "group:shelf:self",
    )!;
    const shelf = shelfGroup.children[0];
    expect(shelf.label).toBe("Regal");
    const nested = shelf.children.find((child) => child.kind === "container")!;
    expect(nested.label).toBe("Ordner im Regal");
    // ... and the nested container still carries its own items.
    expect(nested.children.map((leaf) => leaf.label)).toEqual(["Police"]);
    // The nested folder does NOT additionally appear under the folder group.
    expect(
      groupsOf(root).find((group) => group.id === "group:folder:self"),
    ).toBeUndefined();
    // Item counts roll up through the nesting.
    expect(shelf.itemCount).toBe(1);
    expect(shelfGroup.itemCount).toBe(1);
  });

  it("falls back to the group when the parent is filtered out", () => {
    // The page filters by owner/type; a visible child of an invisible
    // parent must not vanish (and must not crash the build).
    const root = buildInventoryTree(
      [container(2, 11, "Ordner", "folder", "self", 1)],
      [],
    );
    const folderGroup = groupsOf(root).find(
      (group) => group.id === "group:folder:self",
    )!;
    expect(folderGroup.children[0].label).toBe("Ordner");
  });

  it("degrades a data cycle to the group instead of crashing", () => {
    // Should never happen (every write path guards), but if corrupted
    // data arrives the view must render, not throw - tree-kit would.
    const root = buildInventoryTree(
      [
        container(1, 10, "A", "box", "self", 2),
        container(2, 11, "B", "box", "self", 1),
      ],
      [],
    );
    const boxGroup = groupsOf(root).find(
      (group) => group.id === "group:box:self",
    )!;
    // Both render; at least one was detached to break the cycle.
    const labels = new Set<string>();
    const collect = (node: (typeof boxGroup.children)[0]) => {
      labels.add(node.label);
      node.children.forEach(collect);
    };
    boxGroup.children.forEach(collect);
    expect(labels.has("A") && labels.has("B")).toBe(true);
  });

  it("drops an item whose container is not in the input", () => {
    // Filtered container lists are normal (the page filters by owner/type);
    // an item pointing outside the visible set must not throw.
    const forest = groupsOf(
      buildInventoryTree([container(1, 42, "A")], [item(99, 404, "waise")]),
    );
    expect(forest[0].children[0].children).toEqual([]);
  });
});
