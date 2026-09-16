import type { ReactNode } from "react";

import { link } from "../ui/classes";

/** External link: new tab, no referrer leakage of the opener. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={link} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export const GITHUB_PRIVACY_URL =
  "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement";
export const ANTHROPIC_PRIVACY_URL = "https://www.anthropic.com/privacy";
export const OPENAI_PRIVACY_URL = "https://openai.com/policies/privacy-policy";
export const GOOGLE_PRIVACY_URL = "https://policies.google.com/privacy";
export const PERPLEXITY_PRIVACY_URL =
  "https://www.perplexity.ai/hub/legal/privacy-policy";
