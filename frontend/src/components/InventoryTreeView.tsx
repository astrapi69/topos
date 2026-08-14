/**
 * InventoryTreeView - the inventory as the three-level forest it really is:
 * group (type + owner, the workbook's sheets) -> container -> item.
 *
 * Groups start open (they are the overview), containers start closed (their
 * contents are detail). The chevron toggles; the label navigates - container
 * to its detail page, item to its editor.
 *
 * Moving: two surfaces over ONE rule set (`canDrop`/`applyMove` in
 * src/tree/treeMove.ts). Drag-and-drop via @dnd-kit for pointer users -
 * items onto containers, containers onto groups - and a "Verschieben
 * nach..." button per row for touch and assistive tech, where dragging
 * is unreliable. Both end in the same storage write; the tree rebuilds
 * from the refreshed rows, so no node is ever mutated.
 */

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, FolderInput } from "lucide-react";
import { Link } from "react-router-dom";

import { useDialog } from "./AppDialog";
import { useContainerTypes } from "../hooks/useContainerTypes";
import { useI18n } from "../hooks/useI18n";
import { getStorage } from "../storage";
import {
  buildInventoryTree,
  groupKeyOf,
  type GroupLabels,
  type InventoryNode,
} from "../tree/inventoryTree";
import { applyMove, canDrop } from "../tree/treeMove";
import type { Container, ContainerType, Item, Owner } from "../types/topos";
import { errorMessage, notify } from "../utils/notify";
import { iconButton, link, muted } from "../ui/classes";

const OWNERS: readonly Owner[] = ["self", "parents", "shared"];

interface InventoryTreeViewProps {
  containers: Container[];
  items: Item[];
  /** Called after a successful move, so the page can refresh its rows. */
  onMoved?: () => void | Promise<void>;
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

/** Minimal target node for a menu-chosen container - enough for treeMove. */
function containerTargetNode(container: Container): InventoryNode {
  return {
    id: `container:${container.id}`,
    kind: "container",
    label: container.label,
    number: String(container.externalId),
    itemCount: 0,
    container,
    children: [],
  };
}

/** Minimal root node for a menu-chosen detach - enough for treeMove. */
function rootTargetNode(): InventoryNode {
  return {
    id: "root",
    kind: "root",
    label: "Topos",
    number: null,
    itemCount: 0,
    children: [],
  };
}

/** Minimal target node for a menu-chosen group - enough for treeMove. */
function groupTargetNode(
  type: ContainerType,
  owner: Owner,
  label: string,
): InventoryNode {
  return {
    id: groupKeyOf(type, owner),
    kind: "group",
    label,
    number: null,
    itemCount: 0,
    group: { type, owner },
    children: [],
  };
}

function TreeNodeRow({
  node,
  depth,
  open,
  onToggle,
  activeNode,
  onMoveRequest,
}: {
  node: InventoryNode;
  depth: number;
  open: boolean;
  onToggle: () => void;
  activeNode: InventoryNode | null;
  onMoveRequest: (node: InventoryNode) => void;
}) {
  const { t } = useI18n();
  const target = nodeTarget(node);
  const movable = node.kind === "container" || node.kind === "item";
  const droppable =
    node.kind === "container" || node.kind === "group" || node.kind === "root";

  const drag = useDraggable({
    id: node.id,
    data: { node },
    disabled: !movable,
  });
  const drop = useDroppable({
    id: node.id,
    data: { node },
    disabled: !droppable,
  });

  // Light up only targets the CURRENT drag may land on; everything else
  // stays visually inert so the legal moves are discoverable mid-drag.
  const highlight =
    drop.isOver && activeNode !== null && canDrop(activeNode, node);

  return (
    <div
      ref={(element) => {
        drag.setNodeRef(element);
        drop.setNodeRef(element);
      }}
      className={
        "flex items-center gap-1 py-1 rounded" +
        (highlight ? " bg-accent-subtle" : "") +
        (drag.isDragging ? " opacity-50" : "")
      }
      style={{ paddingLeft: `${depth * 1.25}rem` }}
      data-testid={`tree-node-${node.id}`}
      {...drag.attributes}
      {...drag.listeners}
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

      {movable && (
        <button
          type="button"
          onClick={() => onMoveRequest(node)}
          className={iconButton}
          aria-label={t("topos.tree.move.button", "Verschieben nach...")}
          title={t("topos.tree.move.button", "Verschieben nach...")}
          data-testid={`tree-move-${node.id}`}
        >
          <FolderInput size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function TreeBranch({
  node,
  depth,
  openIds,
  onToggle,
  activeNode,
  onMoveRequest,
}: {
  node: InventoryNode;
  depth: number;
  openIds: Set<string>;
  onToggle: (id: string) => void;
  activeNode: InventoryNode | null;
  onMoveRequest: (node: InventoryNode) => void;
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
        activeNode={activeNode}
        onMoveRequest={onMoveRequest}
      />
      {open &&
        node.children.map((child) => (
          <TreeBranch
            key={child.id}
            node={child}
            depth={depth + 1}
            openIds={openIds}
            onToggle={onToggle}
            activeNode={activeNode}
            onMoveRequest={onMoveRequest}
          />
        ))}
    </>
  );
}

export default function InventoryTreeView({
  containers,
  items,
  onMoved,
}: InventoryTreeViewProps) {
  const { t } = useI18n();
  const { choose } = useDialog();
  const { enabled: enabledTypes } = useContainerTypes();
  const [toggledIds, setToggledIds] = useState<Set<string>>(new Set());
  const [activeNode, setActiveNode] = useState<InventoryNode | null>(null);

  // The distance/delay constraints keep plain clicks (links, chevrons)
  // working: a drag only starts after 8px of travel, or a 250ms hold on
  // touch - the touch fallback is the move BUTTON, not the gesture.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

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

  const groupLabel = (type: ContainerType, owner: Owner) =>
    labels.template[owner].replace("{type}", labels.type[type]);

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

  async function executeMove(source: InventoryNode, target: InventoryNode) {
    try {
      await applyMove(source, target, getStorage());
      notify.success(
        t("topos.tree.move.done", "Verschoben: {what} → {where}")
          .replace("{what}", source.label)
          .replace("{where}", target.label),
      );
      await onMoved?.();
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t("topos.tree.move.failed", "Verschieben fehlgeschlagen"),
        ),
        err,
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveNode(null);
    const source = event.active.data.current?.node as InventoryNode | undefined;
    const target = event.over?.data.current?.node as InventoryNode | undefined;
    if (!source || !target || !canDrop(source, target)) return;
    void executeMove(source, target);
  }

  /**
   * The "Verschieben nach..." menu: same rules as the drag, dialog
   * instead of gesture. Every candidate target runs through canDrop, so
   * the menu can never offer what the drop would refuse - self,
   * descendants (cycle), the current parent, the current group.
   */
  async function requestMove(source: InventoryNode) {
    const containerChoices = containers
      .map((candidate) => ({ candidate, node: containerTargetNode(candidate) }))
      .filter(({ node }) => canDrop(source, node))
      .map(({ candidate }) => ({
        value: `container:${candidate.id}`,
        label: `${candidate.externalId} – ${candidate.label}`,
      }));

    const rootChoice =
      source.kind === "container" && canDrop(source, rootTargetNode())
        ? [
            {
              value: "root",
              label: t(
                "topos.tree.move.detach",
                "Auf oberste Ebene (aus dem Container lösen)",
              ),
            },
          ]
        : [];

    const groupChoices =
      source.kind === "container"
        ? enabledTypes.flatMap((type) =>
            OWNERS.map((owner) => ({ type, owner }))
              .filter(({ type: candidateType, owner }) =>
                canDrop(
                  source,
                  groupTargetNode(
                    candidateType,
                    owner,
                    groupLabel(candidateType, owner),
                  ),
                ),
              )
              .map(({ type: candidateType, owner }) => ({
                value: `group:${candidateType}:${owner}`,
                label: groupLabel(candidateType, owner),
              })),
          )
        : [];

    const choices = [...rootChoice, ...containerChoices, ...groupChoices];
    if (choices.length === 0) {
      notify.warning(
        t("topos.tree.move.no_targets", "Kein mögliches Ziel vorhanden."),
      );
      return;
    }

    const picked = await choose(
      t("topos.tree.move.title", "Verschieben nach..."),
      source.label,
      choices,
      t("topos.common.cancel", "Abbrechen"),
    );
    if (picked === null) return;

    let target: InventoryNode | null = null;
    if (picked === "root") {
      target = rootTargetNode();
    } else if (picked.startsWith("container:")) {
      const containerId = Number(picked.replace("container:", ""));
      const container = containers.find(
        (candidate) => candidate.id === containerId,
      );
      if (container) target = containerTargetNode(container);
    } else {
      const [, type, owner] = picked.split(":") as [
        string,
        ContainerType,
        Owner,
      ];
      target = groupTargetNode(type, owner, groupLabel(type, owner));
    }
    if (target) await executeMove(source, target);
  }

  if (root.children.length === 0) {
    return (
      <p className={muted} data-testid="tree-empty">
        {t("topos.tree.empty", "Keine Container vorhanden.")}
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) =>
        setActiveNode(
          (event.active.data.current?.node as InventoryNode) ?? null,
        )
      }
      onDragCancel={() => setActiveNode(null)}
      onDragEnd={handleDragEnd}
    >
      <div data-testid="inventory-tree">
        <TreeBranch
          node={root}
          depth={0}
          openIds={toggledIds}
          onToggle={toggle}
          activeNode={activeNode}
          onMoveRequest={(node) => void requestMove(node)}
        />
      </div>
    </DndContext>
  );
}
