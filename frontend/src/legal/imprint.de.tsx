import { Link } from "react-router-dom";

import { LICENSE_URL } from "../utils/projectLinks";
import { link } from "../ui/classes";
import { OPERATOR } from "./operator";
import { Ext } from "./parts";
import type { LegalDocument } from "./types";

function Content() {
  return (
    <>
      <p>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz).</p>
      <p>
        <strong>{OPERATOR.name}</strong>
        <br />
        {OPERATOR.street}, {OPERATOR.city}, {OPERATOR.countryDe}
        <br />
        E-Mail:{" "}
        <a className={link} href={`mailto:${OPERATOR.email}`}>
          {OPERATOR.email}
        </a>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>{OPERATOR.name}, Anschrift wie oben.</p>

      <h2>Zum Angebot</h2>
      <p>
        Topos ist ein quelloffener Inventar-Tracker unter der MIT-Lizenz. Die
        Nutzung ist kostenlos, es findet kein Verkauf über diese Seite statt.
        Das Angebot enthält freiwillige Spendenmöglichkeiten über Liberapay,
        GitHub Sponsors und Ko-fi.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Die Inhalte dieser Seite und der App wurden mit größter Sorgfalt
        erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der
        Inhalte übernimmt der Betreiber jedoch keine Gewähr. Die Inventardaten,
        die du in der App erfasst, stammen von dir und verbleiben auf deinem
        Gerät; der Betreiber hat darauf keinen Zugriff.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Die App enthält Links zu externen Websites Dritter, auf deren Inhalte
        der Betreiber keinen Einfluss hat. Für diese fremden Inhalte ist stets
        der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die
        verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
        Rechtsverstöße überprüft; eine permanente inhaltliche Kontrolle ist ohne
        konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei
        Bekanntwerden von Rechtsverletzungen werden derartige Links umgehend
        entfernt.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Der Quellcode von Topos steht unter der{" "}
        <Ext href={LICENSE_URL}>MIT-Lizenz</Ext>. Marken und Logos Dritter (zum
        Beispiel GitHub, Anthropic, OpenAI, Google, Perplexity) gehören ihren
        jeweiligen Inhabern.
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Der Betreiber ist nicht bereit und nicht verpflichtet, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen (§ 36 VSBG).
      </p>

      <p>
        Siehe auch die{" "}
        <Link className={link} to="/datenschutz">
          Datenschutzerklärung
        </Link>
        .
      </p>
    </>
  );
}

export const imprintDe: LegalDocument = {
  title: "Impressum",
  updated: "2026-09-16",
  Content,
};
