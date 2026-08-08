import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { dexieStorage as store } from "./dexieStorage";
import { db } from "../db/schema";

beforeEach(async () => {
  await Promise.all([
    db.containers.clear(),
    db.items.clear(),
    db.categories.clear(),
    db.actions.clear(),
  ]);
});

describe("dexieStorage", () => {
  it("creates + lists a container with a local id and filters", async () => {
    const created = await store.containers.create({
      externalId: 42,
      type: "box",
      owner: "self",
      label: "A",
    });
    expect(created.id).toBe(1);
    expect(await store.containers.list()).toHaveLength(1);
    expect(await store.containers.list({ type: "folder" })).toHaveLength(0);
    expect(await store.containers.list({ type: "box" })).toHaveLength(1);
  });

  it("cascade-deletes items and their actions with the container", async () => {
    const container = await store.containers.create({
      externalId: 1,
      type: "box",
      owner: "self",
      label: "A",
    });
    const item = await store.items.create({
      containerId: container.id,
      content: "x",
    });
    await store.actions.create({ itemId: item.id, text: "todo" });

    await store.containers.delete(container.id);

    expect(await db.items.count()).toBe(0);
    expect(await db.actions.count()).toBe(0);
    expect(await db.containers.count()).toBe(0);
  });

  it("completes and reopens an action", async () => {
    const action = await store.actions.create({ itemId: 1, text: "t" });
    const done = await store.actions.complete(action.id);
    expect(done.status).toBe("done");
    expect(done.completedAt).not.toBeNull();
    const open = await store.actions.reopen(action.id);
    expect(open.status).toBe("open");
    expect(open.completedAt).toBeNull();
  });

  it("renames a category, rewriting the subtree and item paths", async () => {
    await store.categories.create({
      path: "office",
      name: "office",
      displayName: "Office",
    });
    await store.categories.create({
      path: "office/pens",
      parentPath: "office",
      name: "pens",
      displayName: "Pens",
    });
    const item = await store.items.create({
      containerId: 1,
      content: "pen",
      categoryPath: "office/pens",
    });
    const parent = await db.categories.where("path").equals("office").first();

    const result = await store.categories.rename(parent!.id, "work");

    expect(result.renamed).toBe(true);
    expect(result.subcategoriesUpdated).toBe(1);
    expect(result.itemsUpdated).toBe(1);
    expect(
      await db.categories.where("path").equals("work/pens").first(),
    ).toBeTruthy();
    expect((await db.items.get(item.id))!.categoryPath).toBe("work/pens");
  });

  it("deletes a category, orphaning items and dropping the subtree", async () => {
    await store.categories.create({ path: "a", name: "a", displayName: "A" });
    await store.categories.create({
      path: "a/b",
      parentPath: "a",
      name: "b",
      displayName: "B",
    });
    const item = await store.items.create({
      containerId: 1,
      content: "x",
      categoryPath: "a/b",
    });
    const root = await db.categories.where("path").equals("a").first();

    const result = await store.categories.delete(root!.id);

    expect(result.itemsOrphaned).toBe(1);
    expect(result.subcategoriesDeleted).toBe(1);
    expect(await db.categories.count()).toBe(0);
    expect((await db.items.get(item.id))!.categoryPath).toBeNull();
  });
});
