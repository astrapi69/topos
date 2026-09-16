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
        Diese Erklärung gilt für die öffentliche Web-Version von Topos unter
        astrapi69.github.io/topos. Wer Topos selbst installiert
        (Desktop-Launcher oder Docker), betreibt die App auf dem eigenen Gerät
        oder Server; dann verarbeitet der Betreiber dieser Seite keine Daten.
      </p>

      <h2>Verantwortlicher</h2>
      <p>
        {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.city},{" "}
        {OPERATOR.countryDe}
        <br />
        E-Mail:{" "}
        <a className={link} href={`mailto:${OPERATOR.email}`}>
          {OPERATOR.email}
        </a>
      </p>

      <h2>Das Wichtigste in Kürze</h2>
      <ul>
        <li>
          Topos hat keinen eigenen Server. Dein Inventar (Container, Einträge,
          Kategorien, Aktionen, Fotos, Einstellungen, verschlüsselte
          API-Schlüssel) liegt ausschließlich in deinem Browser (IndexedDB und
          localStorage). Der Betreiber sieht es nicht.
        </li>
        <li>
          Die App setzt keine Cookies, nutzt keine Analyse- oder
          Tracking-Dienste und braucht kein Konto. Schriften sind mitgeliefert
          und werden nicht von Dritten geladen.
        </li>
        <li>
          Beim Aufruf der App verarbeitet GitHub als Hoster deine IP-Adresse.
          Darüber hinaus gehen Daten nur dann an Dritte, wenn du eine Funktion
          nutzt, die das erfordert (Foto-Erkennung mit eigenem KI-Schlüssel,
          Fehlerbericht auf GitHub, externe Links).
        </li>
      </ul>

      <h2>Hosting bei GitHub Pages</h2>
      <p>
        Die App wird von GitHub Pages ausgeliefert, einem Dienst der GitHub,
        Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Bei
        jedem Aufruf verarbeitet GitHub die IP-Adresse deines Geräts und die
        üblichen Verbindungsdaten (Zeitpunkt, aufgerufene Datei, Browsertyp) zu
        Sicherheitszwecken; nach Angaben von GitHub werden diese Daten nur für
        die Betriebssicherheit gespeichert und nicht an den Betreiber
        weitergegeben.
      </p>
      <p>
        Rechtsgrundlage ist das berechtigte Interesse an einer sicheren und
        performanten Auslieferung (Art. 6 Abs. 1 lit. f DSGVO). GitHub ist unter
        dem EU-US Data Privacy Framework zertifiziert; damit besteht ein
        Angemessenheitsbeschluss für die Übermittlung in die USA (Art. 45
        DSGVO). Weitere Informationen:{" "}
        <Ext href={GITHUB_PRIVACY_URL}>GitHub Privacy Statement</Ext>.
      </p>
      <p>
        Beim Öffnen prüft dein Browser beim selben Hoster, ob eine neue Version
        der App vorliegt (Service Worker und die Datei version.json). Das ist
        ein Abruf bei GitHub Pages wie oben beschrieben, kein zusätzlicher
        Dienst.
      </p>

      <h2>Speicherung im Browser</h2>
      <p>
        Alles, was du in der App anlegst, speichert dein Browser lokal: das
        Inventar samt Fotos in der IndexedDB-Datenbank „topos“, Sprache, Design
        und Einstellungen sowie den mit deiner Passphrase verschlüsselten
        Schlüsseltresor in localStorage, und die App-Dateien für den
        Offline-Start im Cache des Service Workers. Diese Speicherung ist für
        den Betrieb der App zwingend erforderlich und fällt unter die Ausnahme
        in § 25 Abs. 2 Nr. 2 TDDDG; eine Einwilligung ist nicht nötig. Es wird
        nichts an einen Server übertragen.
      </p>
      <p>
        Du kannst dein Inventar jederzeit in den Einstellungen unter „Import
        &amp; Export“ als Datei sichern (Fotos sind derzeit nicht Teil dieser
        Datei), unter „Wartung“ löschen oder die Website-Daten in deinem Browser
        entfernen; damit sind alle oben genannten Speicher geleert.
      </p>

      <h2>KI-Foto-Erkennung mit eigenem Schlüssel</h2>
      <p>
        Die Foto-Erkennung ist nur aktiv, wenn du in den Einstellungen einen
        eigenen API-Schlüssel eines Anbieters hinterlegst (Anthropic, OpenAI,
        Google oder Perplexity). Dann sendet dein Browser das gewählte Foto
        (verkleinert) und die Namen deiner vorhandenen Kategorien direkt an
        diesen Anbieter; OpenAI ist aus dem Browser nicht direkt erreichbar und
        steht nur in einer selbst betriebenen Version mit Backend zur Verfügung.
        Der Schlüssel bleibt verschlüsselt in deinem Browser. Der Betreiber von
        Topos ist an dieser Übermittlung nicht beteiligt und erhält keine Daten.
        Das Vertragsverhältnis besteht zwischen dir und dem Anbieter; es gelten
        dessen Datenschutzhinweise:
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

      <h2>Fehlerberichte über GitHub</h2>
      <p>
        Tritt ein Fehler auf, kannst du einen Bericht öffnen. Die App zeigt ihn
        dir vorher vollständig an. Erst wenn du „Auf GitHub melden“ wählst,
        öffnet sich ein neuer Tab bei GitHub mit einem vorausgefüllten Issue
        (Fehlermeldung, gegebenenfalls Stacktrace, Browserkennung, App-Version
        und deine eigene Beschreibung). Gesendet wird der Bericht erst, wenn du
        ihn dort mit deinem GitHub-Konto abschickst; ab dann gilt die
        Datenschutzerklärung von GitHub. Alternativ kannst du den Bericht nur in
        die Zwischenablage kopieren.
      </p>

      <h2>Externe Links und Teilen-Funktionen</h2>
      <p>
        Die App enthält Links zu externen Angeboten (GitHub, Liberapay, GitHub
        Sponsors, Ko-fi). Erst mit dem Klick verlässt du die App; ab dann gelten
        die Datenschutzhinweise des jeweiligen Anbieters. Es sind keine Skripte
        oder Schaltflächen dieser Anbieter eingebettet. Der QR-Code zum Teilen
        der App wird lokal in deinem Browser erzeugt; der Teilen-Dialog deines
        Geräts erhält nur die Adresse der App.
      </p>

      <h2>Desktop-Version</h2>
      <p>
        Der Desktop-Launcher fragt beim Start die GitHub-API nach der neuesten
        Version von Topos. Dabei erhält GitHub deine IP-Adresse; übermittelt
        wird sonst nichts. Die Prüfung lässt sich in den Launcher-Einstellungen
        abschalten.
      </p>

      <h2>Kontakt per E-Mail</h2>
      <p>
        Wenn du dem Betreiber eine E-Mail schreibst, werden deine Angaben zur
        Bearbeitung der Anfrage gespeichert (Art. 6 Abs. 1 lit. b und f DSGVO)
        und gelöscht, sobald die Anfrage erledigt ist und keine gesetzlichen
        Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast gegenüber dem Verantwortlichen das Recht auf Auskunft (Art. 15
        DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
        Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
        gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21).
        Außerdem kannst du dich bei einer Datenschutzaufsichtsbehörde beschweren
        (Art. 77 DSGVO), zum Beispiel bei der Behörde deines Wohnorts oder des
        Sitzes des Verantwortlichen.
      </p>
      <p>
        Da der Betreiber dein Inventar nicht besitzt, richten sich Auskunfts-
        und Löschbegehren zu diesen Daten an dein eigenes Gerät: Einstellungen,
        „Import &amp; Export“ oder „Wartung“, oder die Website-Daten in deinem
        Browser.
      </p>

      <h2>Änderungen</h2>
      <p>
        Diese Erklärung wird angepasst, wenn sich die App oder die Rechtslage
        ändert. Das Datum der jeweils aktuellen Fassung steht oben.
      </p>

      <p>
        Siehe auch das{" "}
        <Link className={link} to="/impressum">
          Impressum
        </Link>
        .
      </p>
    </>
  );
}

export const privacyDe: LegalDocument = {
  title: "Datenschutzerklärung",
  updated: "2026-09-16",
  Content,
};
