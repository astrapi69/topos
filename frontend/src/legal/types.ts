import type { JSX } from "react";

export type LegalKind = "imprint" | "privacy";
export type LegalLocale = "de" | "en";

export interface LegalDocument {
  /** Page heading in the document's own language. */
  title: string;
  /** ISO date of the current wording, shown as "last updated". */
  updated: string;
  /** The body; may use react-router links, so render inside a router. */
  Content: () => JSX.Element;
}
