/**
 * Operator details for the imprint and the privacy policy.
 *
 * Taken from the sibling project's published imprint
 * (adaptive-learner, docs/help/de/legal/imprint.md, 2026-09-15), which
 * the same operator runs. A change here changes every legal page at
 * once; the test pins that no placeholder ever ships.
 */
export const OPERATOR = {
  name: "Asterios Raptis",
  street: "Seestraße 68",
  city: "71638 Ludwigsburg",
  countryDe: "Deutschland",
  countryEn: "Germany",
  // TODO(clarify): the published sibling imprint spells the address
  // "asteri.raptis", the GitHub account uses "aster.raptis" - confirm
  // which mailbox the imprint should name.
  email: "asteri.raptis@gmail.com",
} as const;
