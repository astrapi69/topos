import { Link } from "react-router-dom";

import { link } from "../ui/classes";
import { OPERATOR } from "./operator";
import {
  ANTHROPIC_PRIVACY_URL,
  Ext,
  GITHUB_PRIVACY_URL,
  GOOGLE_PRIVACY_URL,
  OPENAI_PRIVACY_URL,
  PERPLEXITY_PRIVACY_URL,
} from "./parts";
import type { LegalDocument } from "./types";

function Content() {
  return (
    <>
      <p>
        This policy covers the public web version of Topos at
        astrapi69.github.io/topos. If you install Topos yourself (desktop
        launcher or Docker), the app runs on your own device or server and the
        operator of this site processes no data.
      </p>

      <h2>Controller</h2>
      <p>
        {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.city},{" "}
        {OPERATOR.countryEn}
        <br />
        Email:{" "}
        <a className={link} href={`mailto:${OPERATOR.email}`}>
          {OPERATOR.email}
        </a>
      </p>

      <h2>The short version</h2>
      <ul>
        <li>
          Topos has no server of its own. Your inventory (containers, entries,
          categories, actions, photos, settings, encrypted API keys) lives only
          in your browser (IndexedDB and localStorage). The operator never sees
          it.
        </li>
        <li>
          The app sets no cookies, uses no analytics or tracking services and
          needs no account. Fonts ship with the app and are not loaded from
          third parties.
        </li>
        <li>
          When you open the app, GitHub as the hosting provider processes your
          IP address. Beyond that, data reaches third parties only when you use
          a feature that requires it (photo recognition with your own AI key, an
          error report on GitHub, external links).
        </li>
      </ul>

      <h2>Hosting on GitHub Pages</h2>
      <p>
        The app is served by GitHub Pages, a service of GitHub, Inc., 88 Colin
        P. Kelly Jr. Street, San Francisco, CA 94107, USA. On every request
        GitHub processes your device's IP address and the usual connection data
        (time, requested file, browser type) for security purposes; according to
        GitHub, this data is kept only for operational security and is not
        passed on to the operator.
      </p>
      <p>
        The legal basis is the legitimate interest in secure and performant
        delivery (Art. 6 (1) (f) GDPR). GitHub is certified under the EU-US Data
        Privacy Framework, so an adequacy decision covers the transfer to the
        USA (Art. 45 GDPR). More information:{" "}
        <Ext href={GITHUB_PRIVACY_URL}>GitHub Privacy Statement</Ext>.
      </p>
      <p>
        When you open the app, your browser asks the same host whether a newer
        version exists (the service worker and the file version.json). That is a
        request to GitHub Pages as described above, not an additional service.
      </p>

      <h2>Storage in your browser</h2>
      <p>
        Everything you create in the app is stored locally by your browser: the
        inventory including photos in the IndexedDB database "topos", language,
        theme and settings as well as the key vault encrypted with your
        passphrase in localStorage, and the app files for offline start in the
        service worker cache. This storage is strictly necessary to run the app
        and falls under the exemption in Section 25 (2) no. 2 of the German
        TDDDG; no consent is required. Nothing is transmitted to a server.
      </p>
      <p>
        You can save your inventory as a file at any time under Settings,
        "Import &amp; export" (photos are currently not part of that file),
        delete it under "Maintenance", or clear the site data in your browser,
        which empties all of the stores named above.
      </p>

      <h2>AI photo recognition with your own key</h2>
      <p>
        Photo recognition is active only if you enter your own API key for a
        provider in Settings (Anthropic, OpenAI, Google or Perplexity). Your
        browser then sends the chosen photo (downscaled) and the names of your
        existing categories directly to that provider; OpenAI cannot be reached
        from the browser directly and is available only in a self-hosted version
        with a backend. The key stays encrypted in your browser. The operator of
        Topos is not involved in this transfer and receives no data. The
        contract exists between you and the provider, whose privacy notice
        applies:
      </p>
      <ul>
        <li>
          <Ext href={ANTHROPIC_PRIVACY_URL}>Anthropic</Ext>
        </li>
        <li>
          <Ext href={OPENAI_PRIVACY_URL}>OpenAI</Ext>
        </li>
        <li>
          <Ext href={GOOGLE_PRIVACY_URL}>Google</Ext>
        </li>
        <li>
          <Ext href={PERPLEXITY_PRIVACY_URL}>Perplexity</Ext>
        </li>
      </ul>

      <h2>Error reports via GitHub</h2>
      <p>
        When an error occurs you can open a report. The app shows it to you in
        full first. Only when you choose "Report on GitHub" does a new tab open
        at GitHub with a prefilled issue (error message, a stack trace if
        available, browser identification, app version and your own
        description). The report is sent only when you submit it there with your
        GitHub account; from then on GitHub's privacy statement applies.
        Alternatively you can copy the report to the clipboard.
      </p>

      <h2>External links and share features</h2>
      <p>
        The app contains links to external services (GitHub, Liberapay, GitHub
        Sponsors, Ko-fi). You leave the app only when you click; from then on
        the respective provider's privacy notice applies. No scripts or buttons
        of these providers are embedded. The QR code for sharing the app is
        generated locally in your browser; your device's share dialog receives
        only the app's address.
      </p>

      <h2>Desktop version</h2>
      <p>
        On start, the desktop launcher asks the GitHub API for the latest Topos
        version. GitHub receives your IP address in the process; nothing else is
        transmitted. The check can be switched off in the launcher settings.
      </p>

      <h2>Contact by email</h2>
      <p>
        If you email the operator, your details are stored to handle the request
        (Art. 6 (1) (b) and (f) GDPR) and deleted once the request is settled
        and no statutory retention obligation applies.
      </p>

      <h2>Your rights</h2>
      <p>
        Towards the controller you have the right of access (Art. 15 GDPR),
        rectification (Art. 16), erasure (Art. 17), restriction of processing
        (Art. 18), data portability (Art. 20) and objection to processing based
        on legitimate interests (Art. 21). You may also lodge a complaint with a
        data protection supervisory authority (Art. 77 GDPR), for example the
        authority at your place of residence or at the controller's seat.
      </p>
      <p>
        Because the operator does not hold your inventory, access and erasure
        requests concerning that data are handled on your own device: Settings,
        "Import &amp; export" or "Maintenance", or the site data in your
        browser.
      </p>

      <h2>Changes</h2>
      <p>
        This policy is updated when the app or the legal situation changes. The
        date of the current version is shown at the top.
      </p>

      <p>
        See also the{" "}
        <Link className={link} to="/impressum">
          legal notice
        </Link>
        .
      </p>
    </>
  );
}

export const privacyEn: LegalDocument = {
  title: "Privacy policy",
  updated: "2026-09-16",
  Content,
};
