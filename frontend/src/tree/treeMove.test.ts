/**
 * Move rules for the inventory tree. The tree is a projection, so a
 * "move" is a flat-row update through the storage seam: an item changes
 * its containerId (the service re-numbers it there), a container
 * changes its parent container (nesting: folders stand in shelves,
 * boxes in cabinets) or its (type, owner) pair. The rules below are the whole truth
 * both the drag gesture and the "Verschieben nach..." menu consult -
 * one function, two surfaces.
 */

import { describe, expect, it, vi } from "vitest";

import type { Container, Item } from "../types/topos";
import { buildInventoryTree, type InventoryNode } from "./inventoryTree";
import { applyMove, canDrop } from "./treeMove";

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
    parentContainerId,
    description: null,
    location: null,
    sizeGroup: null,
    createdAt: "",
    updatedAt: "",
  };
}

function item(id: number, containerId: number, content: string): Item {
  return {
    id,
    containerId,
    externalId: 1,
    content,
    priority: "none",
    categoryPath: null,
    notes: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Two top-level folders, a box, a folder nested in the box, one item. */
function testTree() {
  const root = buildInventoryTree(
    [
      container(1, 42, "Quelle"),
      container(2, 43, "Ziel"),
      container(3, 9, "Kiste", "box", "self"),
      container(4, 44, "Im-Karton", "folder", "self", 3),
    ],
    [item(10, 1, "Police")],
  );
  const nodes = new Map<string, InventoryNode>();
  const walk = (node: InventoryNode) => {
    nodes.set(node.id, node);
    node.children.forEach(walk);
  };
  walk(root);
  return { root, nodes };
}

describe("canDrop", () => {
  it("allows an item onto another container", () => {
    const { nodes } = testTree();
    expect(canDrop(nodes.get("item:10")!, nodes.get("container:2")!)).toBe(
      true,
    );
  });

  it("rejects an item onto its own container (a no-op is not a move)", () => {
    const { nodes } = testTree();
    expect(canDrop(nodes.get("item:10")!, nodes.get("container:1")!)).toBe(
      false,
    );
  });

  it("rejects an item onto a group or the root", () => {
    const { nodes, root } = testTree();
    expect(
      canDrop(nodes.get("item:10")!, nodes.get("group:folder:self")!),
    ).toBe(false);
    expect(canDrop(nodes.get("item:10")!, root)).toBe(false);
  });

  it("allows a container onto a different group", () => {
    const { nodes } = testTree();
    expect(
      canDrop(nodes.get("container:1")!, nodes.get("group:box:self")!),
    ).toBe(true);
  });

  it("rejects a container onto its own group", () => {
    const { nodes } = testTree();
    expect(
      canDrop(nodes.get("container:1")!, nodes.get("group:folder:self")!),
    ).toBe(false);
  });

  it("allows a container onto another container (nesting)", () => {
    const { nodes } = testTree();
    expect(canDrop(nodes.get("container:1")!, nodes.get("container:2")!)).toBe(
      true,
    );
  });

  it("rejects a container onto itself", () => {
    const { nodes } = testTree();
    expect(canDrop(nodes.get("container:1")!, nodes.get("container:1")!)).toBe(
      false,
    );
  });

  it("rejects a container onto its own descendant (cycle)", () => {
    const { nodes } = testTree();
    // Im-Karton (4) stands in Kiste (3): Kiste into Im-Karton would loop.
    expect(canDrop(nodes.get("container:3")!, nodes.get("container:4")!)).toBe(
      false,
    );
  });

  it("rejects a container onto its current parent (no-op)", () => {
    const { nodes } = testTree();
    expect(canDrop(nodes.get("container:4")!, nodes.get("container:3")!)).toBe(
      false,
    );
  });

  it("allows detaching a nested container onto the root", () => {
    const { nodes, root } = testTree();
    expect(canDrop(nodes.get("container:4")!, root)).toBe(true);
  });

  it("rejects root for a container already at top level", () => {
    const { nodes, root } = testTree();
    expect(canDrop(nodes.get("container:1")!, root)).toBe(false);
  });

  it("allows a NESTED container onto its own (type, owner) group - that detaches", () => {
    const { nodes } = testTree();
    // Im-Karton is folder/self and nested; dropping on group:folder:self
    // pulls it back to that group's top level.
    expect(
      canDrop(nodes.get("container:4")!, nodes.get("group:folder:self")!),
    ).toBe(true);
  });
});

describe("applyMove", () => {
  function fakeStorage() {
    return {
      items: { update: vi.fn(async () => ({}) as never) },
      containers: { update: vi.fn(async () => ({}) as never) },
    };
  }

  it("moves an item by updating its containerId", async () => {
    const { nodes } = testTree();
    const storage = fakeStorage();

    await applyMove(
      nodes.get("item:10")!,
      nodes.get("container:2")!,
      storage as never,
    );

    expect(storage.items.update).toHaveBeenCalledWith(10, { containerId: 2 });
    expect(storage.containers.update).not.toHaveBeenCalled();
  });

  it("moves a container by updating its (type, owner) pair", async () => {
    const { nodes } = testTree();
    const storage = fakeStorage();

    await applyMove(
      nodes.get("container:1")!,
      nodes.get("group:box:self")!,
      storage as never,
    );

    expect(storage.containers.update).toHaveBeenCalledWith(1, {
      type: "box",
      owner: "self",
      parentContainerId: null,
    });
    expect(storage.items.update).not.toHaveBeenCalled();
  });

  it("nests a container by updating its parentContainerId", async () => {
    const { nodes } = testTree();
    const storage = fakeStorage();

    await applyMove(
      nodes.get("container:1")!,
      nodes.get("container:2")!,
      storage as never,
    );

    expect(storage.containers.update).toHaveBeenCalledWith(1, {
      parentContainerId: 2,
    });
  });

  it("detaches on a root drop", async () => {
    const { nodes, root } = testTree();
    const storage = fakeStorage();

    await applyMove(nodes.get("container:4")!, root, storage as never);

    expect(storage.containers.update).toHaveBeenCalledWith(4, {
      parentContainerId: null,
    });
  });

  it("a group drop sets the pair AND detaches", async () => {
    const { nodes } = testTree();
    const storage = fakeStorage();

    await applyMove(
      nodes.get("container:4")!,
      nodes.get("group:folder:self")!,
      storage as never,
    );

    expect(storage.containers.update).toHaveBeenCalledWith(4, {
      type: "folder",
      owner: "self",
      parentContainerId: null,
    });
  });

  it("refuses an illegal move instead of writing", async () => {
    const { nodes } = testTree();
    const storage = fakeStorage();

    await expect(
      applyMove(
        nodes.get("container:1")!,
        nodes.get("container:1")!,
        storage as never,
      ),
    ).rejects.toThrow();
    expect(storage.containers.update).not.toHaveBeenCalled();
    expect(storage.items.update).not.toHaveBeenCalled();
  });
});
