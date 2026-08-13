/**
 * Settings card: which container types this device's forms offer.
 *
 * folder and box are always on and render as fixed text; the rest of
 * the curated enum is a checkbox each. Pure visibility filter - the
 * card says so, because a user seeing an "unknown" type on an imported
 * container must not conclude the data is broken.
 */

import { useI18n } from "../../hooks/useI18n";
import { useContainerTypes } from "../../hooks/useContainerTypes";
import { containerTypeLabel } from "../../utils/containerTypeLabel";
import { DEFAULT_CONTAINER_TYPES } from "../../types/topos";
import { card, muted } from "../../ui/classes";

export default function ContainerTypesSection() {
  const { t } = useI18n();
  const { optional, isEnabled, setTypeEnabled } = useContainerTypes();

  return (
    <section
      style={{ marginBottom: "1.5rem" }}
      data-testid="container-types-section"
    >
      <h2>{t("topos.page.settings.types.heading", "Container-Typen")}</h2>
      <div className={`${card} p-3`}>
        <p className={`${muted} text-sm mt-0`}>
          {t(
            "topos.page.settings.types.intro",
            "Bestimmt, welche Typen die Formulare anbieten. Vorhandene Container und Importe funktionieren unabhängig davon mit jedem Typ.",
          )}
        </p>
        <p className="text-sm">
          {t("topos.page.settings.types.defaults", "Immer verfügbar:")}{" "}
          {DEFAULT_CONTAINER_TYPES.map((containerType) =>
            containerTypeLabel(containerType, t),
          ).join(", ")}
        </p>
        <ul className="list-none m-0 p-0 flex flex-col gap-1">
          {optional.map((containerType) => (
            <li key={containerType}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled(containerType)}
                  onChange={(e) =>
                    setTypeEnabled(containerType, e.target.checked)
                  }
                  data-testid={`container-type-toggle-${containerType}`}
                />
                {containerTypeLabel(containerType, t)}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
