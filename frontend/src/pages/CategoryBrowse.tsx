/**
 * Browse the category tree as a Radix Collapsible accordion.
 *
 * Each node shows the count of items under it (inclusive of
 * descendants). Clicking a node filters the right pane to items
 * whose ``categoryPath`` starts with that node's path.
 *
 * With a reachable backend every node carries rename + delete
 * actions; both cascade server-side into subcategories and
 * ``Item.category_path`` references (issue #11). Offline mode is
 * read-only - the mutations need the backend as source of truth.
 */

import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useFeature } from "@astrapi69/feature-strategy-react";

import NavBar from "../components/NavBar";
import { getStorage } from "../storage";
import { db } from "../db/schema";
import { useDialog } from "../components/AppDialog";
import { FEATURES } from "../features/featureConfig";
import { refreshAll, useItems } from "../hooks/useTopos";
import { useI18n } from "../hooks/useI18n";
import { isBackendAvailable } from "../utils/backendStatus";
import { buildCategoryTree } from "../utils/categoryTree";
import { notify, errorMessage } from "../utils/notify";
import { text, muted, link, selected as selectedCls } from "../ui/classes";
import type { CategoryNode, Item } from "../types/topos";

export default function CategoryBrowse() {
  const { t } = useI18n();
  const { prompt, confirm } = useDialog();
  const items = useItems();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Rename/delete cascade server-side, so they need a reachable backend.
  // The gate now comes from the feature layer (AppFeatureProvider owns the
  // /api/health probe) instead of a local backendUp flag.
  const categoryEdit = useFeature(FEATURES.CATEGORY_EDIT);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Offline (no-backend PWA): never call the API - it would 404.
      // Build the tree from the Dexie cache (empty cache -> empty tree).
      const available = await isBackendAvailable();
      if (!available) {
        const cached = await db.categories.toArray();
        if (!cancelled) setTree(buildCategoryTree(cached));
        return;
      }
      try {
        const data = await getStorage().categories.tree();
        if (!cancelled) setTree(data);
      } catch (e) {
        if (!cancelled) {
          notify.error(
            errorMessage(
              e,
              t(
                "topos.toast.categories_load_failed",
                "Kategorien konnten nicht geladen werden",
              ),
            ),
            e,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  async function findCategoryId(path: string): Promise<number | null> {
    const rows = await getStorage().categories.list();
    return rows.find((row) => row.path === path)?.id ?? null;
  }

  async function refreshAfterMutation(): Promise<void> {
    await refreshAll();
    await items.refresh();
    setReloadKey((key) => key + 1);
  }

  async function handleRename(node: CategoryNode): Promise<void> {
    const newPath = await prompt(
      t("topos.category.rename", "Umbenennen"),
      t(
        "topos.category.rename_message",
        "Neuer Pfad (english-kebab-case, '/' trennt Ebenen). Einträge und Unterkategorien ziehen mit um.",
      ),
      "finance/bank",
      node.path,
    );
    if (
      newPath === null ||
      newPath.trim() === "" ||
      newPath.trim() === node.path
    )
      return;
    try {
      const categoryId = await findCategoryId(node.path);
      if (categoryId === null) {
        notify.error(
          t(
            "topos.toast.categories_load_failed",
            "Kategorien konnten nicht geladen werden",
          ),
        );
        return;
      }
      const result = await getStorage().categories.rename(
        categoryId,
        newPath.trim(),
      );
      notify.success(
        t(
          "topos.category.rename_success",
          "Kategorie umbenannt. {count} Items aktualisiert.",
        ).replace("{count}", String(result.itemsUpdated)),
      );
      if (selected === node.path || selected?.startsWith(`${node.path}/`)) {
        setSelected(
          result.category.path + (selected?.slice(node.path.length) ?? ""),
        );
      }
      await refreshAfterMutation();
    } catch (e) {
      notify.error(
        errorMessage(
          e,
          t(
            "topos.toast.category_rename_failed",
            "Kategorie konnte nicht umbenannt werden",
          ),
        ),
        e,
      );
    }
  }

  async function handleDelete(node: CategoryNode): Promise<void> {
    const affected = itemsByPathPrefix.get(node.path)?.length ?? 0;
    const ok = await confirm(
      t("topos.common.delete", "Löschen"),
      t(
        "topos.category.delete_confirm",
        "{count} Items verlieren ihre Kategorie. Fortfahren?",
      ).replace("{count}", String(affected)),
      "danger",
      {
        confirmLabel: t("topos.common.delete", "Löschen"),
        cancelLabel: t("topos.common.cancel", "Abbrechen"),
      },
    );
    if (!ok) return;
    try {
      const categoryId = await findCategoryId(node.path);
      if (categoryId === null) {
        notify.error(
          t(
            "topos.toast.categories_load_failed",
            "Kategorien konnten nicht geladen werden",
          ),
        );
        return;
      }
      const result = await getStorage().categories.delete(categoryId);
      notify.success(
        t(
          "topos.category.delete_success",
          "Kategorie gelöscht. {count} Items ohne Kategorie.",
        ).replace("{count}", String(result.itemsOrphaned)),
      );
      if (selected === node.path || selected?.startsWith(`${node.path}/`)) {
        setSelected(null);
      }
      await refreshAfterMutation();
    } catch (e) {
      notify.error(
        errorMessage(
          e,
          t(
            "topos.toast.category_delete_failed",
            "Kategorie konnte nicht gelöscht werden",
          ),
        ),
        e,
      );
    }
  }

  const itemsByPathPrefix = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items.data) {
      if (!item.categoryPath) continue;
      const segments = item.categoryPath.split("/");
      for (let i = 1; i <= segments.length; i++) {
        const prefix = segments.slice(0, i).join("/");
        const bucket = map.get(prefix) ?? [];
        bucket.push(item);
        map.set(prefix, bucket);
      }
    }
    return map;
  }, [items.data]);

  const filteredItems = selected
    ? (itemsByPathPrefix.get(selected) ?? [])
    : items.data.filter((i) => !i.categoryPath);

  return (
    <>
      <NavBar />
      <main className="p-4 sm:p-6">
        <h1 data-testid="category-browse-title">
          {t("topos.page.categories.title", "Kategorien")}
        </h1>

        {/*
         * Master-detail: stacked on mobile (tree first, then the
         * item list below), side-by-side from md up.
         */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,1fr)_2fr] gap-6 mt-4">
          <aside data-testid="category-tree">
            <button
              type="button"
              data-testid="category-show-uncategorized"
              onClick={() => setSelected(null)}
              className={`${text} ${
                selected === null ? selectedCls : "bg-transparent"
              } w-full text-left rounded cursor-pointer border-0 px-2 py-2.5 md:py-1 min-h-[44px] md:min-h-0`}
            >
              {t("topos.page.categories.uncategorized", "Ohne Kategorie")}
            </button>
            {tree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                selected={selected}
                setSelected={setSelected}
                counts={itemsByPathPrefix}
                onRename={categoryEdit.isActive ? handleRename : undefined}
                onDelete={categoryEdit.isActive ? handleDelete : undefined}
              />
            ))}
            {tree.length === 0 && (
              <p className={muted}>
                {t("topos.page.categories.empty", "Noch keine Kategorien.")}
              </p>
            )}
          </aside>

          <section data-testid="category-items">
            <h2>
              {selected
                ? selected
                : t(
                    "topos.page.categories.uncategorized",
                    "Ohne Kategorie",
                  )}{" "}
              <small className={muted}>({filteredItems.length})</small>
            </h2>
            <ul>
              {filteredItems.map((item) => (
                <li key={item.id} data-testid={`category-item-${item.id}`}>
                  <Link to={`/containers/${item.containerId}`} className={link}>
                    {item.content}
                  </Link>{" "}
                  <small className={muted}>({item.categoryPath ?? "-"})</small>
                </li>
              ))}
              {filteredItems.length === 0 && (
                <li className={muted}>
                  {t("topos.page.categories.no_items", "Keine Einträge.")}
                </li>
              )}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}

function TreeNode({
  node,
  selected,
  setSelected,
  counts,
  onRename,
  onDelete,
  depth = 0,
}: {
  node: CategoryNode;
  selected: string | null;
  setSelected: (path: string) => void;
  counts: Map<string, Item[]>;
  /** Absent in offline mode - mutations need the backend. */
  onRename?: (node: CategoryNode) => void;
  onDelete?: (node: CategoryNode) => void;
  depth?: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isSelected = selected === node.path;
  const count = counts.get(node.path)?.length ?? 0;
  const hasChildren = node.children.length > 0;

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      data-testid={`category-node-${node.path.replace(/\//g, "-")}`}
    >
      <div
        className={`flex items-center rounded ${isSelected ? selectedCls : ""}`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <Collapsible.Trigger
            data-testid={`category-toggle-${node.path.replace(/\//g, "-")}`}
            aria-label={
              open
                ? t("topos.page.categories.collapse", "Zuklappen")
                : t("topos.page.categories.expand", "Aufklappen")
            }
            className={`${text} cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center w-8 md:w-5 min-h-[44px] md:min-h-0 shrink-0`}
          >
            {open ? (
              <ChevronDown size={16} aria-hidden />
            ) : (
              <ChevronRight size={16} aria-hidden />
            )}
          </Collapsible.Trigger>
        ) : (
          <span className="w-8 md:w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => setSelected(node.path)}
          data-testid={`category-select-${node.path.replace(/\//g, "-")}`}
          className={`${text} flex-1 text-left cursor-pointer bg-transparent border-0 px-2 py-2.5 md:py-1 min-h-[44px] md:min-h-0`}
        >
          {node.displayName} <small className={muted}>({count})</small>
        </button>
        {onRename && (
          <button
            type="button"
            data-testid={`category-rename-${node.path.replace(/\//g, "-")}`}
            aria-label={t("topos.category.rename", "Umbenennen")}
            title={t("topos.category.rename", "Umbenennen")}
            onClick={() => onRename(node)}
            className="text-ink-muted hover:text-ink bg-transparent border-0 cursor-pointer p-1 min-h-[44px] md:min-h-0 shrink-0"
          >
            <Pencil size={15} aria-hidden />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            data-testid={`category-delete-${node.path.replace(/\//g, "-")}`}
            aria-label={t("topos.common.delete", "Löschen")}
            title={t("topos.common.delete", "Löschen")}
            onClick={() => onDelete(node)}
            className="text-ink-muted hover:text-danger bg-transparent border-0 cursor-pointer p-1 min-h-[44px] md:min-h-0 shrink-0"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        )}
      </div>
      <Collapsible.Content>
        {node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            selected={selected}
            setSelected={setSelected}
            counts={counts}
            onRename={onRename}
            onDelete={onDelete}
            depth={depth + 1}
          />
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
