import { Link } from "react-router-dom";

import { LICENSE_URL } from "../utils/projectLinks";
import { link } from "../ui/classes";
import { OPERATOR } from "./operator";
import { Ext } from "./parts";
import type { LegalDocument } from "./types";

function Content() {
  return (
    <>
      <p>
        Information pursuant to Section 5 of the German Digital Services Act
        (DDG).
      </p>
      <p>
        <strong>{OPERATOR.name}</strong>
        <br />
        {OPERATOR.street}, {OPERATOR.city}, {OPERATOR.countryEn}
        <br />
        Email:{" "}
        <a className={link} href={`mailto:${OPERATOR.email}`}>
          {OPERATOR.email}
        </a>
      </p>

      <h2>
        Responsible for the content under Section 18 (2) of the German State
        Media Treaty (MStV)
      </h2>
      <p>{OPERATOR.name}, address as above.</p>

      <h2>About this offering</h2>
      <p>
        Topos is an open-source inventory tracker under the MIT licence. Using
        it is free of charge; nothing is sold through this site. The offering
        contains voluntary donation options via Liberapay, GitHub Sponsors and
        Ko-fi.
      </p>

      <h2>Liability for content</h2>
      <p>
        The content of this site and of the app has been created with great
        care. The operator nevertheless gives no guarantee for the accuracy,
        completeness or currency of the content. The inventory data you record
        in the app comes from you and stays on your device; the operator has no
        access to it.
      </p>

      <h2>Liability for links</h2>
      <p>
        The app contains links to external third-party websites over whose
        content the operator has no influence. The respective provider or
        operator of those pages is always responsible for their content. The
        linked pages were checked for possible legal violations at the time of
        linking; a permanent review of their content is not reasonable without
        concrete indications of a violation. Such links will be removed promptly
        once a violation becomes known.
      </p>

      <h2>Copyright</h2>
      <p>
        The source code of Topos is released under the{" "}
        <Ext href={LICENSE_URL}>MIT licence</Ext>. Third-party trademarks and
        logos (for example GitHub, Anthropic, OpenAI, Google, Perplexity) belong
        to their respective owners.
      </p>

      <h2>Consumer dispute resolution</h2>
      <p>
        The operator is neither willing nor obliged to take part in dispute
        resolution proceedings before a consumer arbitration board (Section 36
        VSBG).
      </p>

      <p>
        See also the{" "}
        <Link className={link} to="/datenschutz">
          privacy policy
        </Link>
        .
      </p>
    </>
  );
}

export const imprintEn: LegalDocument = {
  title: "Legal notice",
  updated: "2026-09-16",
  Content,
};
