/**
 * Settings section listing items whose ``categoryPath`` no longer
 * resolves to a category (orphan report, issue #11).
 *
 * Per row: item content, the dangling path, a link to the owning
 * container, plus "reassign" (pick an existing category) and "remove
 * path" actions. A bulk "remove all paths" clears every orphan at
 * once behind a confirmation dialog. Hidden entirely in PWA mode
 * (no backend) - the report and the fixes both need the API.
 *
 * Testid namespace: `orphan-paths-*`; per-row ids are
 * `orphan-row-{itemId}` plus `-reassign`, `-reassign-select`,
 * `-remove` suffixes.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, type OrphanedItem } from "../api/client";
import { useDialog } from "./AppDialog";
import { refreshAll, useCategories } from "../hooks/useTopos";
import { useI18n } from "../hooks/useI18n";
import { notify, errorMessage } from "../utils/notify";
import { btn, btnText, btnTextDanger, input, link, muted } from "../ui/classes";

export default function OrphanPathsSection() {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const categories = useCategories();
  const [orphans, setOrphans] = useState<OrphanedItem[] | null>(null);
  const [reassigning, setReassigning] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.categories
      .orphans()
      .then((report) => {
        if (!cancelled) setOrphans(report.orphanedItems);
      })
      .catch(() => {
        /* PWA mode (no backend) or transient failure - hide the section. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (orphans === null) return null;

  async function reload(): Promise<void> {
    const report = await api.categories.orphans();
    setOrphans(report.orphanedItems);
    await refreshAll();
  }

  async function assignPath(
    item: OrphanedItem,
    path: string | null,
  ): Promise<void> {
    setBusy(true);
    try {
      await api.items.update(item.id, { categoryPath: path });
      notify.success(
        path
          ? t("topos.category.orphans_reassigned", "Kategorie zugeordnet.")
          : t("topos.category.orphans_removed", "Pfad entfernt."),
      );
      setReassigning(null);
      await reload();
    } catch (e) {
      notify.error(
        errorMessage(
          e,
          t(
            "topos.toast.item_save_failed",
            "Eintrag konnte nicht gespeichert werden",
          ),
        ),
        e,
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeAll(): Promise<void> {
    if (orphans === null || orphans.length === 0) return;
    const ok = await confirm(
      t("topos.category.orphans_remove_all", "Alle Pfade entfernen"),
      t(
        "topos.category.orphans_remove_all_confirm",
        "{count} Items verlieren ihren verwaisten Kategorienpfad.",
      ).replace("{count}", String(orphans.length)),
      "danger",
      {
        confirmLabel: t(
          "topos.category.orphans_remove_all",
          "Alle Pfade entfernen",
        ),
        cancelLabel: t("topos.common.cancel", "Abbrechen"),
      },
    );
    if (!ok) return;
    setBusy(true);
    try {
      for (const item of orphans) {
        await api.items.update(item.id, { categoryPath: null });
      }
      notify.success(t("topos.category.orphans_removed", "Pfad entfernt."));
      await reload();
    } catch (e) {
      notify.error(
        errorMessage(
          e,
          t(
            "topos.toast.item_save_failed",
            "Eintrag konnte nicht gespeichert werden",
          ),
        ),
        e,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6" data-testid="orphan-paths-section">
      <h2>{t("topos.category.orphans_title", "Verwaiste Kategorienpfade")}</h2>
      {orphans.length === 0 ? (
        <p className={muted} data-testid="orphan-paths-empty">
          {t("topos.category.orphans_empty", "Keine verwaisten Pfade.")}
        </p>
      ) : (
        <>
          <p className={muted}>
            {t(
              "topos.category.orphans_description",
              "Diese Einträge zeigen auf Kategorien, die nicht mehr existieren.",
            )}
          </p>
          <ul className="flex flex-col gap-2 list-none p-0 m-0 mt-2">
            {orphans.map((item) => (
              <li
                key={item.id}
                data-testid={`orphan-row-${item.id}`}
                className="flex flex-wrap items-center gap-2 border-b border-line pb-2"
              >
                <span className="mr-auto">
                  {item.content}{" "}
                  <code className={`${muted} font-mono text-xs`}>
                    {item.categoryPath}
                  </code>{" "}
                  <Link
                    to={`/containers/${item.containerId}`}
                    className={`${link} text-sm`}
                    data-testid={`orphan-container-link-${item.id}`}
                  >
                    {t("topos.item.container", "Container")}
                  </Link>
                </span>
                {reassigning === item.id ? (
                  <select
                    className={input}
                    autoFocus
                    disabled={busy}
                    data-testid={`orphan-row-${item.id}-reassign-select`}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) void assignPath(item, e.target.value);
                    }}
                  >
                    <option value="">
                      {t(
                        "topos.page.photo_intake.no_category",
                        "Keine Kategorie",
                      )}
                    </option>
                    {categories.data.map((category) => (
                      <option key={category.id} value={category.path}>
                        {category.path}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className={btnText}
                    disabled={busy}
                    data-testid={`orphan-row-${item.id}-reassign`}
                    onClick={() => setReassigning(item.id)}
                  >
                    {t("topos.category.orphans_reassign", "Neu zuordnen")}
                  </button>
                )}
                <button
                  type="button"
                  className={btnTextDanger}
                  disabled={busy}
                  data-testid={`orphan-row-${item.id}-remove`}
                  onClick={() => void assignPath(item, null)}
                >
                  {t("topos.category.orphans_remove", "Pfad entfernen")}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${btn} mt-3`}
            disabled={busy}
            data-testid="orphan-paths-remove-all"
            onClick={() => void removeAll()}
          >
            {t("topos.category.orphans_remove_all", "Alle Pfade entfernen")}
          </button>
        </>
      )}
    </section>
  );
}
