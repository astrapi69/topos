/**
 * i18n label for a container type - the singular form used in selects
 * and badges. The tree's group headers use their own plural keys
 * (topos.tree.group.*); this is the "one of them" wording.
 *
 * @example
 * const { t } = useI18n();
 * containerTypeLabel("drawer", t); // "Schublade"
 */

import type { ContainerType } from "../types/topos";

type Translate = (key: string, fallback: string) => string;

const FALLBACKS: Record<ContainerType, string> = {
  folder: "Ordner",
  box: "Box",
  drawer: "Schublade",
  shelf: "Regal",
  case: "Koffer",
  safe: "Tresor",
};

export function containerTypeLabel(
  containerType: ContainerType,
  t: Translate,
): string {
  return t(`topos.container.type.${containerType}`, FALLBACKS[containerType]);
}
