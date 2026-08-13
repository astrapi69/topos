/**
 * Which container types this device's forms offer.
 *
 * A UI visibility filter, never a data rule: storage and the API accept
 * every enum value unconditionally, imports and existing rows keep
 * working whatever is toggled here. folder and box are always on; the
 * rest of the curated enum is opt-in (Settings > Container-Typen).
 *
 * Persisted per device in localStorage (like the theme and language
 * choices), so it works identically against a backend and in the
 * offline PWA.
 */

import { useCallback, useState } from "react";

import {
  CONTAINER_TYPES,
  DEFAULT_CONTAINER_TYPES,
  type ContainerType,
} from "../types/topos";

const STORAGE_KEY = "topos.container_types";

/** The opt-in half of the curated enum. */
export const OPTIONAL_CONTAINER_TYPES: readonly ContainerType[] =
  CONTAINER_TYPES.filter(
    (containerType) => !DEFAULT_CONTAINER_TYPES.includes(containerType),
  );

function readExtras(): ContainerType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter against the enum: stale or hand-edited junk must not leak
    // an invalid type into the forms, which feed create payloads.
    return OPTIONAL_CONTAINER_TYPES.filter((containerType) =>
      parsed.includes(containerType),
    );
  } catch {
    return [];
  }
}

function writeExtras(extras: ContainerType[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(extras));
  } catch {
    /* private mode: the toggle simply does not persist */
  }
}

export function useContainerTypes(): {
  /** Types the forms offer, in curated-enum order. */
  enabled: ContainerType[];
  /** The toggleable half, for the Settings card. */
  optional: readonly ContainerType[];
  isEnabled: (containerType: ContainerType) => boolean;
  setTypeEnabled: (containerType: ContainerType, on: boolean) => void;
} {
  const [extras, setExtras] = useState<ContainerType[]>(readExtras);

  const setTypeEnabled = useCallback(
    (containerType: ContainerType, on: boolean) => {
      // The defaults are not toggleable; silently keeping them on beats
      // an error state for a control the UI never renders.
      if (DEFAULT_CONTAINER_TYPES.includes(containerType)) return;
      setExtras((current) => {
        const next = on
          ? OPTIONAL_CONTAINER_TYPES.filter(
              (candidate) =>
                current.includes(candidate) || candidate === containerType,
            )
          : current.filter((candidate) => candidate !== containerType);
        writeExtras(next);
        return next;
      });
    },
    [],
  );

  const enabled = CONTAINER_TYPES.filter(
    (containerType) =>
      DEFAULT_CONTAINER_TYPES.includes(containerType) ||
      extras.includes(containerType),
  );

  return {
    enabled,
    optional: OPTIONAL_CONTAINER_TYPES,
    isEnabled: (containerType) => enabled.includes(containerType),
    setTypeEnabled,
  };
}
