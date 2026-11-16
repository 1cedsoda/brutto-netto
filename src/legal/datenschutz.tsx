import { A, Address, H2, P, renderLegalPage } from "./LegalLayout";
import { company } from "./company";

renderLegalPage(
  "Datenschutzerklärung",
  <>
    <P>Stand: November 2026</P>
    <P>
      Kurz gesagt: Der Brutto-Netto-Rechner rechnet vollständig in deinem Browser. Deine Eingaben
      (z.&nbsp;B. Gehalt, Steuerklasse, Krankenkasse) werden nicht an uns übertragen. Wir setzen
      keine Cookies, kein Tracking, keine Analyse- oder Werbedienste und keine externen
      Schriftarten ein.
    </P>

    <H2>1. Verantwortlicher</H2>
    <Address lines={[company.name, ...company.addressLines]} />
    <P>
      Vertreten durch: {company.representatives}
      <br />
      E-Mail: <A href={`mailto:${company.email}`}>{company.email}</A>
    </P>
    <P>
      Ein Datenschutzbeauftragter ist nicht bestellt, da die gesetzlichen Voraussetzungen hierfür
      nicht vorliegen.
    </P>

    <H2>2. Hosting und Server-Logfiles</H2>
    <P>
      Diese Website wird über Cloudflare Workers bereitgestellt. Anbieter ist die Cloudflare, Inc.,
      101 Townsend St, San Francisco, CA 94107, USA. Beim Aufruf der Website verarbeitet Cloudflare
      technisch notwendige Verbindungsdaten, insbesondere IP-Adresse, Datum und Uhrzeit des Abrufs,
      angeforderte Datei, übertragene Datenmenge, Referrer-URL sowie Browser- und
      Betriebssysteminformationen. Diese Daten sind erforderlich, um die Website auszuliefern und
      vor Angriffen (z.&nbsp;B. DDoS) zu schützen.
    </P>
    <P>
      Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in einer
      sicheren, stabilen und schnellen Bereitstellung der Website. Wir haben mit Cloudflare einen
      Auftragsverarbeitungsvertrag (Art. 28 DSGVO) geschlossen. Cloudflare ist unter dem
      EU-US Data Privacy Framework zertifiziert (Angemessenheitsbeschluss, Art. 45 DSGVO);
      ergänzend gelten die EU-Standardvertragsklauseln. Wir selbst werten keine Zugriffsdaten aus
      und führen keine Logs über einzelne Besucher. Weitere Informationen:{" "}
      <A href="https://www.cloudflare.com/privacypolicy/">cloudflare.com/privacypolicy</A>.
    </P>

    <H2>3. Lokale Speicherung im Browser</H2>
    <P>
      Damit deine Eingaben und Einstellungen (Szenarien, Sprache, Farbschema, Anzeige monatlich
      oder jährlich) beim nächsten Besuch erhalten bleiben, speichert der Rechner sie im
      Local Storage deines Browsers unter dem Schlüssel „brutto-netto-2025“. Diese Daten verlassen
      dein Gerät nicht und sind für uns nicht einsehbar.
    </P>
    <P>
      Die Speicherung ist für die von dir ausdrücklich gewünschte Funktion unbedingt erforderlich
      (§ 25 Abs. 2 Nr. 2 TDDDG). Du kannst die Daten jederzeit über die Einstellungen deines
      Browsers (Websitedaten löschen) entfernen.
    </P>

    <H2>4. Zwischenablage</H2>
    <P>
      Die Funktion „Als Text kopieren“ legt das Ergebnis ausschließlich lokal in der Zwischenablage
      deines Geräts ab. Dabei werden keine Daten an uns übertragen.
    </P>

    <H2>5. Externe Links</H2>
    <P>
      Die Website verlinkt auf den Quellcode bei GitHub (GitHub, Inc., USA). Erst wenn du einen
      solchen Link anklickst, werden Daten an den jeweiligen Anbieter übertragen; es gilt dann
      dessen Datenschutzerklärung.
    </P>

    <H2>6. Kontakt per E-Mail</H2>
    <P>
      Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine Angaben (E-Mail-Adresse, Name,
      Inhalt der Nachricht) zur Bearbeitung deiner Anfrage auf Grundlage von Art. 6 Abs. 1 lit. b
      bzw. lit. f DSGVO. Die Daten werden gelöscht, sobald sie für die Bearbeitung nicht mehr
      erforderlich sind und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
    </P>

    <H2>7. Deine Rechte</H2>
    <P>
      Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung
      (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO), Datenübertragbarkeit
      (Art. 20 DSGVO) sowie Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1
      lit. f DSGVO (Art. 21 DSGVO). Wende dich dazu an{" "}
      <A href={`mailto:${company.email}`}>{company.email}</A>.
    </P>
    <P>
      Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).
      Für uns zuständig ist die Berliner Beauftragte für Datenschutz und Informationsfreiheit,
      Alt-Moabit 59–61, 10555 Berlin,{" "}
      <A href="https://www.datenschutz-berlin.de">datenschutz-berlin.de</A>.
    </P>

    <H2>8. Keine automatisierte Entscheidungsfindung</H2>
    <P>
      Eine automatisierte Entscheidungsfindung oder ein Profiling im Sinne von Art. 22 DSGVO findet
      nicht statt.
    </P>
  </>,
);
