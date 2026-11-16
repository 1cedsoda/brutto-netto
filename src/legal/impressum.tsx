import { A, Address, H2, P, renderLegalPage } from "./LegalLayout";
import { company } from "./company";

renderLegalPage(
  "Impressum",
  <>
    <H2>Angaben gemäß § 5 DDG</H2>
    <Address lines={[company.name, ...company.addressLines]} />
    <P>Vertreten durch: {company.representatives}</P>

    <H2>Registereintrag</H2>
    <P>
      Registergericht: {company.registerCourt}
      <br />
      Registernummer: {company.register}
    </P>

    <H2>Umsatzsteuer-ID</H2>
    <P>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {company.vatId}</P>

    <H2>Kontakt</H2>
    <P>
      E-Mail: <A href={`mailto:${company.email}`}>{company.email}</A>
    </P>

    <H2>Verantwortlich für den Inhalt i.&nbsp;S.&nbsp;d. § 18 Abs. 2 MStV</H2>
    <Address lines={[company.contentResponsible, ...company.addressLines]} />

    <H2>Keine Steuer- oder Rechtsberatung</H2>
    <P>
      Der Brutto-Netto-Rechner dient ausschließlich der unverbindlichen Orientierung. Alle
      Berechnungen erfolgen nach bestem Wissen, jedoch ohne Gewähr für Richtigkeit, Vollständigkeit
      und Aktualität. Sie ersetzen keine individuelle Beratung durch Steuerberater:innen oder die
      Entgeltabrechnung des Arbeitgebers.
    </P>

    <H2>Haftung für Inhalte</H2>
    <P>
      Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
      Gesetzen verantwortlich. Für fremde Inhalte gelten die Haftungsbeschränkungen der Artikel 4
      bis 8 der Verordnung (EU) 2022/2065 in Verbindung mit § 7 Abs. 1 DDG.
    </P>

    <H2>Haftung für Links</H2>
    <P>
      Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
      Einfluss haben. Für diese fremden Inhalte ist stets der jeweilige Anbieter oder Betreiber der
      Seiten verantwortlich.
    </P>

    <H2>Urheberrecht und Open Source</H2>
    <P>
      Der Quellcode dieses Rechners ist als Open Source unter der MIT-Lizenz veröffentlicht:{" "}
      <A href={company.sourceUrl}>{company.sourceUrl.replace("https://", "")}</A>.
    </P>

    <H2>Verbraucherstreitbeilegung</H2>
    <P>
      Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
      Verbraucherschlichtungsstelle teilzunehmen (§ 36 Abs. 1 Nr. 1 VSBG).
    </P>
  </>,
);
