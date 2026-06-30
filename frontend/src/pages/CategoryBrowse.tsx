/**
 * Browse the category tree as a Radix Collapsible accordion.
 *
 * Each node shows the count of items under it (inclusive of
 * descendants). Clicking a node filters the right pane to items
 * whose ``categoryPath`` starts with that node's path.
 */

import * as Collapsible from "@radix-ui/react-collapsible";
import {useEffect, useMemo, useState} from "react";
import {Link} from "react-router-dom";

import NavBar from "../components/NavBar";
import {api} from "../api/client";
import {useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import {text, muted, link, selected as selectedCls} from "../ui/classes";
import type {CategoryNode, Item} from "../types/topos";

export default function CategoryBrowse() {
    const {t} = useI18n();
    const items = useItems();
    const [tree, setTree] = useState<CategoryNode[]>([]);
    const [selected, setSelected] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        api.categories
            .tree()
            .then((data) => {
                if (!cancelled) setTree(data);
            })
            .catch((e) => {
                if (!cancelled) {
                    notify.error(
                        errorMessage(e, t("topos.toast.categories_load_failed", "Kategorien konnten nicht geladen werden")),
                        e,
                    );
                }
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        ? itemsByPathPrefix.get(selected) ?? []
        : items.data.filter((i) => !i.categoryPath);

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif"}}>
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
                            className={`${text} ${selected === null ? selectedCls : ""} w-full text-left rounded cursor-pointer`}
                            style={{
                                background: selected === null ? undefined : "none",
                                border: "none",
                                padding: "0.25rem 0.5rem",
                            }}
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
                                : t("topos.page.categories.uncategorized", "Ohne Kategorie")}
                            {" "}
                            <small className={muted}>
                                ({filteredItems.length})
                            </small>
                        </h2>
                        <ul>
                            {filteredItems.map((item) => (
                                <li key={item.id} data-testid={`category-item-${item.id}`}>
                                    <Link to={`/containers/${item.containerId}`} className={link}>
                                        {item.content}
                                    </Link>{" "}
                                    <small className={muted}>
                                        ({item.categoryPath ?? "-"})
                                    </small>
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
    depth = 0,
}: {
    node: CategoryNode;
    selected: string | null;
    setSelected: (path: string) => void;
    counts: Map<string, Item[]>;
    depth?: number;
}) {
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
                style={{paddingLeft: `${depth * 12}px`}}
            >
                {hasChildren ? (
                    <Collapsible.Trigger
                        data-testid={`category-toggle-${node.path.replace(/\//g, "-")}`}
                        className={`${text} cursor-pointer`}
                        style={{
                            background: "none",
                            border: "none",
                            width: 20,
                            padding: 0,
                        }}
                    >
                        {open ? "v" : ">"}
                    </Collapsible.Trigger>
                ) : (
                    <span style={{width: 20}} />
                )}
                <button
                    type="button"
                    onClick={() => setSelected(node.path)}
                    data-testid={`category-select-${node.path.replace(/\//g, "-")}`}
                    className={`${text} flex-1 text-left cursor-pointer`}
                    style={{
                        background: "none",
                        border: "none",
                        padding: "0.25rem 0.5rem",
                    }}
                >
                    {node.displayName}{" "}
                    <small className={muted}>({count})</small>
                </button>
            </div>
            <Collapsible.Content>
                {node.children.map((child) => (
                    <TreeNode
                        key={child.path}
                        node={child}
                        selected={selected}
                        setSelected={setSelected}
                        counts={counts}
                        depth={depth + 1}
                    />
                ))}
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
