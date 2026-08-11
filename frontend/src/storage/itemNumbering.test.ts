/**
 * Per-container item numbers in dexie mode.
 *
 * Containers carry a user-facing externalId ("Nr. 42"); items carry one
 * too, counted per container, so an entry can be referenced the way it
 * is found physically: third entry in folder 42 is "42-3". Mirrors the
 * backend service (app/services/items.py) so both modes number alike.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { dexieStorage } from "./dexieStorage";
import { db } from "../db/schema";

beforeEach(async () => {
  await Promise.all([
    db.containers.clear(),
    db.items.clear(),
    db.actions.clear(),
  ]);
});

async function container(externalId: number) {
  return dexieStorage.containers.create({
    externalId,
    type: "folder",
    owner: "self",
    label: `Folder ${externalId}`,
    description: null,
    location: null,
    sizeGroup: null,
  });
}

describe("dexie item numbering", () => {
  it("counts from one per container", async () => {
    const first = await container(42);
    const second = await container(100);
    const a = await dexieStorage.items.create({
      containerId: first.id,
      content: "A",
    });
    const b = await dexieStorage.items.create({
      containerId: first.id,
      content: "B",
    });
    const c = await dexieStorage.items.create({
      containerId: second.id,
      content: "C",
    });

    expect([a.externalId, b.externalId]).toEqual([1, 2]);
    expect(c.externalId).toBe(1);
  });

  it("does not hand a deleted item's number to a later one", async () => {
    const folder = await container(7);
    const a = await dexieStorage.items.create({
      containerId: folder.id,
      content: "A",
    });
    await dexieStorage.items.create({ containerId: folder.id, content: "B" });
    await dexieStorage.items.delete(a.id);

    const c = await dexieStorage.items.create({
      containerId: folder.id,
      content: "C",
    });
    expect(c.externalId).toBe(3);
  });

  it("renumbers an item moved to another container", async () => {
    const source = await container(1);
    const target = await container(2);
    await dexieStorage.items.create({
      containerId: target.id,
      content: "existing",
    });
    const moving = await dexieStorage.items.create({
      containerId: source.id,
      content: "moving",
    });
    expect(moving.externalId).toBe(1);

    const moved = await dexieStorage.items.update(moving.id, {
      containerId: target.id,
    });
    expect(moved.externalId).toBe(2);
  });

  it("numbers every row of a bulk create", async () => {
    const folder = await container(55);
    const result = await dexieStorage.items.bulkCreate([
      { containerId: folder.id, content: "one" },
      { containerId: folder.id, content: "two" },
    ]);
    expect(result.errors).toEqual([]);
    const listed = await dexieStorage.items.list({ containerId: folder.id });
    expect(listed.map((row) => row.externalId)).toEqual([1, 2]);
  });

  it("keeps an explicitly supplied number (Excel import)", async () => {
    // An imported workbook carries the number the entry already had;
    // re-assigning it would break a label already written on paper.
    const folder = await container(11);
    const imported = await dexieStorage.items.create({
      containerId: folder.id,
      content: "aus Excel",
      externalId: 7,
    });
    expect(imported.externalId).toBe(7);

    // The next auto-assigned number continues above it.
    const following = await dexieStorage.items.create({
      containerId: folder.id,
      content: "danach",
    });
    expect(following.externalId).toBe(8);
  });

  it("lets the user renumber within the container", async () => {
    const folder = await container(12);
    const item = await dexieStorage.items.create({
      containerId: folder.id,
      content: "A",
    });
    const renumbered = await dexieStorage.items.update(item.id, {
      externalId: 17,
    });
    expect(renumbered.externalId).toBe(17);

    // Auto-assignment continues above the highest.
    const following = await dexieStorage.items.create({
      containerId: folder.id,
      content: "B",
    });
    expect(following.externalId).toBe(18);
  });

  it("rejects a number already used in the same container", async () => {
    const folder = await container(13);
    await dexieStorage.items.create({ containerId: folder.id, content: "A" });
    const second = await dexieStorage.items.create({
      containerId: folder.id,
      content: "B",
    });

    await expect(
      dexieStorage.items.update(second.id, { externalId: 1 }),
    ).rejects.toThrow(/13-1/);
  });

  it("allows the same number in a different container", async () => {
    // Only the (container, number) pair is unique: 14-1 and 15-1 coexist.
    const first = await container(14);
    const second = await container(15);
    await dexieStorage.items.create({ containerId: first.id, content: "A" });
    const other = await dexieStorage.items.create({
      containerId: second.id,
      content: "B",
    });
    const renumbered = await dexieStorage.items.update(other.id, {
      externalId: 1,
    });
    expect(renumbered.externalId).toBe(1);
  });

  it("does not clash with the item's own number", async () => {
    const folder = await container(16);
    const item = await dexieStorage.items.create({
      containerId: folder.id,
      content: "A",
    });
    const updated = await dexieStorage.items.update(item.id, {
      externalId: item.externalId,
      content: "A bearbeitet",
    });
    expect(updated.content).toBe("A bearbeitet");
  });

  it("backfills rows stored before the field existed", async () => {
    const folder = await container(9);
    // Write straight to Dexie, as an older build would have.
    await db.items.put({
      id: 999,
      containerId: folder.id,
      content: "legacy",
      priority: "none",
      categoryPath: null,
      notes: null,
      createdAt: "",
      updatedAt: "",
    } as never);

    const listed = await dexieStorage.items.list({ containerId: folder.id });
    expect(listed.every((row) => row.externalId != null)).toBe(true);
    expect(listed[0].externalId).toBe(1);
  });
});
