/**
 * InventoryTreeView - the inventory as the three-level forest it really is:
 * group (type + owner, the workbook's sheets) -> container -> item.
 *
 * Groups start open (they are the overview), containers start closed (their
 * contents are detail). The chevron toggles; the label navigates - container
 * to its detail page, item to its editor. Pure props in, no data fetching:
 * the page passes the same filtered rows the list view renders.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../hooks/useI18n";
import {
  buildInventoryTree,
  type GroupLabels,
  type InventoryNode,
} from "../tree/inventoryTree";
import type { Container, Item } from "../types/topos";
import { iconButton, link, muted } from "../ui/classes";

interface InventoryTreeViewProps {
  containers: Container[];
  items: Item[];
}

function nodeTarget(node: InventoryNode): string | null {
  if (node.kind === "container" && node.container) {
    return `/containers/${node.container.id}`;
  }
  if (node.kind === "item" && node.item) {
    return `/items/${node.item.id}`;
  }
  return null;
}

function TreeNodeRow({
  node,
  depth,
  open,
  onToggle,
}: {
  node: InventoryNode;
  depth: number;
  open: boolean;
  onToggle: () => void;
}) {
  const target = nodeTarget(node);

  return (
    <div
      className="flex items-center gap-1 py-1"
      style={{ paddingLeft: `${depth * 1.25}rem` }}
      data-testid={`tree-node-${node.id}`}
    >
      {node.kind !== "item" ? (
        <button
          type="button"
          onClick={onToggle}
          className={iconButton}
          aria-expanded={open}
          data-testid={`tree-toggle-${node.id}`}
        >
          {open ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </button>
      ) : (
        // Leaves get the same indent slot so labels align within a level.
        <span className="inline-block w-[24px]" aria-hidden="true" />
      )}

      {node.number !== null && (
        <span className={`${muted} font-mono text-sm`}>{node.number}</span>
      )}

      {target ? (
        <Link to={target} className={link} data-testid={`tree-link-${node.id}`}>
          {node.label}
        </Link>
      ) : (
        <span className="font-medium text-ink">{node.label}</span>
      )}

      {node.kind !== "item" && (
        <span className={`${muted} text-sm`}>({node.itemCount})</span>
      )}
    </div>
  );
}

function TreeBranch({
  node,
  depth,
  openIds,
  onToggle,
}: {
  node: InventoryNode;
  depth: number;
  openIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  // Root and groups are the overview and start open; containers are detail
  // and start closed. The set tracks the EXCEPTIONS to that default, so one
  // state container serves both directions without seeding ids upfront.
  const openByDefault = node.kind === "root" || node.kind === "group";
  const open = openByDefault ? !openIds.has(node.id) : openIds.has(node.id);

  return (
    <>
      <TreeNodeRow
        node={node}
        depth={depth}
        open={open}
        onToggle={() => onToggle(node.id)}
      />
      {open &&
        node.children.map((child) => (
          <TreeBranch
            key={child.id}
            node={child}
            depth={depth + 1}
            openIds={openIds}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export default function InventoryTreeView({
  containers,
  items,
}: InventoryTreeViewProps) {
  const { t } = useI18n();
  const [toggledIds, setToggledIds] = useState<Set<string>>(new Set());

  const labels: GroupLabels = {
    type: {
      folder: t("topos.tree.group.folder", "Ordner"),
      box: t("topos.tree.group.box", "Boxen"),
      drawer: t("topos.tree.group.drawer", "Schubladen"),
      shelf: t("topos.tree.group.shelf", "Regale"),
      case: t("topos.tree.group.case", "Koffer"),
      safe: t("topos.tree.group.safe", "Tresore"),
    },
    template: {
      self: t("topos.tree.group.self", "Meine {type}"),
      parents: t("topos.tree.group.parents", "{type} Eltern"),
      shared: t("topos.tree.group.shared", "{type} geteilt"),
    },
  };

  const root = buildInventoryTree(containers, items, labels);

  const toggle = (id: string) => {
    setToggledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (root.children.length === 0) {
    return (
      <p className={muted} data-testid="tree-empty">
        {t("topos.tree.empty", "Keine Container vorhanden.")}
      </p>
    );
  }

  return (
    <div data-testid="inventory-tree">
      <TreeBranch
        node={root}
        depth={0}
        openIds={toggledIds}
        onToggle={toggle}
      />
    </div>
  );
}
