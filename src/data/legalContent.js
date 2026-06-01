import { LEGAL_OPERATOR, LEGAL_PLACEHOLDERS } from '../constants/legal.js';

function operatorBlock() {
  return [
    LEGAL_OPERATOR.name,
    LEGAL_OPERATOR.street,
    `${LEGAL_OPERATOR.zip} ${LEGAL_OPERATOR.city}`,
  ];
}

export const impressumSections = [
  {
    id: 'betreiber',
    title: 'Angaben gemäß § 5 TMG',
    paragraphs: operatorBlock(),
  },
  {
    id: 'kontakt',
    title: 'Kontakt',
    paragraphs: [
      `E-Mail: ${LEGAL_OPERATOR.email}`,
      `Telefon: ${LEGAL_OPERATOR.phone ?? LEGAL_PLACEHOLDERS.phone}`,
    ],
  },
  {
    id: 'register',
    title: 'Rechtliche Angaben',
    paragraphs: [
      `Rechtsform: ${LEGAL_OPERATOR.legalForm ?? LEGAL_PLACEHOLDERS.legalForm}`,
      `USt-ID: ${LEGAL_OPERATOR.vatId ?? LEGAL_PLACEHOLDERS.vatId}`,
      `Handelsregister: ${LEGAL_OPERATOR.tradeRegister ?? LEGAL_PLACEHOLDERS.tradeRegister}`,
    ],
    note: 'Diese Felder werden vor dem Livebetrieb ergänzt und durch einen Fachanwalt geprüft.',
  },
  {
    id: 'plattform',
    title: 'Plattform',
    paragraphs: [
      'Clever-Neuwagen ist ein KI-gestützter Fahrzeugberater und eine digitale Vermittlungsplattform für Neuwagenangebote teilnehmender Autohäuser.',
      'Clever-Neuwagen verkauft keine Fahrzeuge und ist nicht Vertragspartner beim Kauf, Leasing oder bei Finanzierungen.',
    ],
  },
  {
    id: 'haftung-inhalt',
    title: 'Haftung für Inhalte',
    paragraphs: [
      'Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.',
      'Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.',
    ],
  },
  {
    id: 'haftung-links',
    title: 'Haftung für Links',
    paragraphs: [
      'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.',
      'Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.',
    ],
  },
  {
    id: 'urheberrecht',
    title: 'Urheberrecht',
    paragraphs: [
      'Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht.',
      'Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.',
    ],
  },
];

export const datenschutzSections = [
  {
    id: 'hinweis',
    title: 'Wichtiger Hinweis',
    paragraphs: [
      'Diese Datenschutzerklärung dient als technische Vorlage und ersetzt keine anwaltliche Prüfung.',
      'Vor produktivem Einsatz sollte der Text durch eine qualifizierte Rechtsberatung geprüft und an die tatsächliche Datenverarbeitung angepasst werden.',
    ],
    highlight: true,
  },
  {
    id: 'verantwortlicher',
    title: '1. Verantwortlicher',
    paragraphs: [
      'Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:',
      `${LEGAL_OPERATOR.name}, ${LEGAL_OPERATOR.street}, ${LEGAL_OPERATOR.zip} ${LEGAL_OPERATOR.city}`,
      `E-Mail: ${LEGAL_OPERATOR.email}`,
    ],
  },
  {
    id: 'daten-kunden',
    title: '2. Verarbeitete Daten – Kunden',
    paragraphs: [
      'Im Rahmen der Nutzung durch Endkunden können folgende personenbezogene Daten verarbeitet werden:',
    ],
    list: [
      'Name',
      'E-Mail-Adresse',
      'Telefonnummer',
      'Postleitzahl',
      'Fahrzeuginteressen und Konfigurationsdaten',
      'Angebotsanfragen und Kommunikationsinhalte',
      'Kundenkonto-Daten (sofern genutzt)',
    ],
  },
  {
    id: 'daten-haendler',
    title: '3. Verarbeitete Daten – Händler',
    paragraphs: [
      'Teilnehmende Autohäuser stellen uns folgende Daten zur Verfügung:',
    ],
    list: [
      'Firmenname',
      'Ansprechpartner',
      'E-Mail-Adresse',
      'Telefonnummer',
      'Vertrags- und Konditionsdaten',
      'Lagerfahrzeuge und Lieferzeiten',
    ],
  },
  {
    id: 'plattformfunktionen',
    title: '4. Plattformfunktionen',
    paragraphs: [
      'Die Datenverarbeitung erfolgt im Zusammenhang mit folgenden Funktionen:',
    ],
    list: [
      'KI-Beratung und Fahrzeugempfehlungen',
      'Fahrzeugvergleich',
      'Angebotssystem und Angebotsvermittlung',
      'Händlerportal und Konditionsverwaltung',
      'Kundenkonto',
      'Kontaktformulare und Verkaufschancen-Weiterleitung',
    ],
  },
  {
    id: 'angebotsanfragen',
    title: '5. Angebotsanfragen',
    paragraphs: [
      'Wenn Sie ein Angebot anfragen, speichern wir Ihre Angaben zur Bearbeitung der Anfrage und zur Weiterleitung an das jeweilige teilnehmende Autohaus.',
      'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Vermittlung).',
      'Clever-Neuwagen ist nicht Vertragspartner des Kauf-, Leasing- oder Finanzierungsvertrags.',
    ],
  },
  {
    id: 'kundenkonto',
    title: '6. Kundenkonto',
    paragraphs: [
      'Sofern ein Kundenkonto angeboten wird, verarbeiten wir die für Registrierung und Nutzung erforderlichen Daten.',
      'Bei Login per E-Mail-Code wird ein zeitlich begrenzter Bestätigungscode an Ihre E-Mail-Adresse gesendet.',
      'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.',
    ],
  },
  {
    id: 'speicherdauer',
    title: '7. Speicherdauer',
    paragraphs: [
      'Personenbezogene Daten werden gelöscht, sobald der Zweck der Speicherung entfällt und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.',
      'Angebots- und Kommunikationsdaten können für die Dauer der Geschäftsbeziehung und darüber hinaus gemäß gesetzlicher Fristen gespeichert werden.',
    ],
  },
  {
    id: 'rechte',
    title: '8. Betroffenenrechte',
    paragraphs: [
      'Sie haben gegenüber uns folgende Rechte hinsichtlich der Sie betreffenden personenbezogenen Daten:',
    ],
    list: [
      'Recht auf Auskunft (Art. 15 DSGVO)',
      'Recht auf Berichtigung (Art. 16 DSGVO)',
      'Recht auf Löschung (Art. 17 DSGVO)',
      'Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)',
      'Recht auf Datenübertragbarkeit (Art. 20 DSGVO)',
      'Recht auf Widerspruch (Art. 21 DSGVO)',
      'Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)',
    ],
  },
  {
    id: 'hosting',
    title: '9. Hosting',
    paragraphs: [
      'Diese Website wird bei einem externen Dienstleister gehostet (Hoster).',
      'Personenbezogene Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert.',
      'Details zum Hoster und zu Serverstandorten sind bei Bedarf zu ergänzen.',
    ],
  },
  {
    id: 'cookies',
    title: '10. Cookies',
    paragraphs: [
      'Derzeit setzen wir ausschließlich technisch notwendige Cookies bzw. vergleichbare lokale Speichermechanismen ein, die für den Betrieb der Plattform erforderlich sind.',
      'Optionale Analyse- und Marketing-Tools sind vorbereitet, aber derzeit nicht aktiv.',
      'Sofern solche Tools aktiviert werden, holen wir vorab Ihre Einwilligung über unser Cookie-Banner ein.',
    ],
  },
  {
    id: 'analyse',
    title: '11. Analyse- und Marketing-Tools (vorbereitet, deaktiviert)',
    paragraphs: [
      'Für eine spätere Nutzung von Webanalyse- und Marketing-Tools ist die technische und rechtliche Vorbereitung getroffen.',
      'Aktivierung erfolgt erst nach Implementierung des Einwilligungsmanagements und Anpassung dieser Datenschutzerklärung.',
    ],
    list: [
      'Google Analytics (vorbereitet, nicht aktiv)',
      'Meta Pixel (vorbereitet, nicht aktiv)',
      'Microsoft Clarity (vorbereitet, nicht aktiv)',
      'Hotjar (vorbereitet, nicht aktiv)',
    ],
  },
  {
    id: 'kontakt-ds',
    title: '12. Kontakt Datenschutz',
    paragraphs: [
      `Bei Fragen zum Datenschutz wenden Sie sich bitte an: ${LEGAL_OPERATOR.email}`,
    ],
  },
];

export const agbSections = [
  {
    id: 'rolle',
    title: 'Wichtigste Regel',
    paragraphs: [
      'Clever-Neuwagen verkauft keine Fahrzeuge.',
      'Clever-Neuwagen vermittelt Informationen, Angebote und Kontakte zwischen Kunden und teilnehmenden Händlern.',
      'Verträge über Kauf, Leasing oder Finanzierung entstehen ausschließlich zwischen dem jeweiligen Kunden und dem jeweiligen Händler.',
    ],
    highlight: true,
  },
  {
    id: 'preise',
    title: 'Hinweis zu Preisen und Konditionen',
    paragraphs: [
      'Alle Preise, Leasingraten, Finanzierungsraten und Lieferzeiten auf Clever-Neuwagen sind unverbindliche Beispielwerte.',
      'Maßgeblich ist ausschließlich das schriftliche Angebot des jeweiligen Händlers.',
    ],
    highlight: true,
  },
  {
    id: 'geltungsbereich',
    title: '1. Geltungsbereich',
    paragraphs: [
      'Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform Clever-Neuwagen durch Verbraucher und andere Nutzer.',
      'Abweichende Bedingungen des Nutzers werden nicht anerkannt, es sei denn, wir stimmen ihrer Geltung ausdrücklich schriftlich zu.',
    ],
  },
  {
    id: 'leistungen',
    title: '2. Leistungen der Plattform',
    paragraphs: [
      'Clever-Neuwagen stellt folgende Leistungen bereit:',
    ],
    list: [
      'Fahrzeugsuche',
      'KI-Beratung und Fahrzeugempfehlungen',
      'Fahrzeugvergleich',
      'Angebotsvermittlung',
      'Händlervermittlung und Kontaktweiterleitung',
    ],
  },
  {
    id: 'nutzerpflichten',
    title: '3. Nutzerpflichten',
    paragraphs: [
      'Nutzer sind verpflichtet, wahrheitsgemäße Angaben zu machen und die Plattform nicht missbräuchlich zu verwenden.',
      'Es ist untersagt, automatisierte Systeme zum Auslesen von Daten einzusetzen, soweit dies nicht ausdrücklich erlaubt ist.',
    ],
  },
  {
    id: 'angebotsinformationen',
    title: '4. Angebotsinformationen',
    paragraphs: [
      'Konfigurationen, Leasing- und Finanzierungsbeispiele sind unverbindliche Rechenbeispiele auf Basis hinterlegter Parameter.',
      'Bonitätsprüfungen, individuelle Händlerrabatte und Sonderkonditionen können das Ergebnis verändern.',
      'Ein verbindliches Angebot entsteht erst durch schriftliche Bestätigung des jeweiligen Autohauses.',
    ],
  },
  {
    id: 'haftung',
    title: '5. Haftung',
    paragraphs: [
      'Clever-Neuwagen haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.',
      'Clever-Neuwagen übernimmt keine Haftung für Preisänderungen, Lieferzeitänderungen, Herstelleränderungen oder Ausstattungsänderungen durch Händler oder Hersteller.',
      'Für Inhalte, Preise, Verfügbarkeiten und Angebote der teilnehmenden Händler ist der jeweilige Händler verantwortlich.',
    ],
  },
  {
    id: 'schluss',
    title: '6. Schlussbestimmungen',
    paragraphs: [
      'Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.',
      'Gerichtsstand richtet sich nach den gesetzlichen Vorschriften.',
      'Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.',
      `Stand: ${new Date().getFullYear()}`,
    ],
  },
];

export const haendlerAgbSections = [
  {
    id: 'plattformmodell',
    title: 'Plattformmodell',
    paragraphs: [
      'Clever-Neuwagen stellt die technische Plattform zur Vermittlung von Neuwagenangeboten bereit.',
      'Clever-Neuwagen ist nicht Vertragspartner zwischen Händler und Endkunde.',
    ],
    highlight: true,
  },
  {
    id: 'cn-pflege',
    title: 'Clever-Neuwagen übernimmt',
    paragraphs: [
      'Folgende Daten werden zentral von Clever-Neuwagen gepflegt:',
    ],
    list: [
      'Fahrzeugdaten und Modellpflege',
      'Preislisten und UPE',
      'Ausstattungsdaten, Farben und Pakete',
      'WLTP-Daten',
    ],
  },
  {
    id: 'haendler-pflege',
    title: 'Händler pflegt',
    paragraphs: [
      'Der Händler ist verantwortlich für folgende Angaben im Händlerbereich:',
    ],
    list: [
      'Rabatte und Sonderkonditionen',
      'Leasingfaktoren',
      'Finanzierungsdaten',
      'Lieferzeiten',
      'Lagerfahrzeuge',
    ],
  },
  {
    id: 'haendlerverantwortung',
    title: 'Händlerverantwortung',
    paragraphs: [
      'Der Händler bleibt verantwortlich für:',
    ],
    list: [
      'Preisangaben und Rabatte',
      'Leasingangebote',
      'Finanzierungsangebote',
      'Verfügbarkeit und Liefertermine',
      'Rechtliche Richtigkeit seiner Angebote gegenüber Endkunden',
    ],
  },
  {
    id: 'erfolgsprovision',
    title: 'Erfolgsprovision',
    paragraphs: [
      'Eine Erfolgsprovision entsteht ausschließlich bei bestätigter Fahrzeugauslieferung eines über Clever-Neuwagen vermittelten Kunden.',
      'Die genaue Höhe richtet sich nach der jeweils gültigen Händlervereinbarung.',
    ],
  },
  {
    id: 'plattformgebuehr',
    title: 'Plattformgebühr',
    paragraphs: [
      'Gemäß aktueller Händlervereinbarung.',
      'Die konkrete Höhe und Abrechnung wird in der individuellen Händlervereinbarung festgelegt und ist später im Admin konfigurierbar.',
    ],
  },
  {
    id: 'daten',
    title: 'Daten und Inhalte',
    paragraphs: [
      'Der Händler stellt Clever-Neuwagen die zur Plattformnutzung erforderlichen Geschäfts- und Kontaktdaten zur Verfügung.',
      'Clever-Neuwagen darf diese Daten zur Bereitstellung der Plattform, Verkaufschancen-Weiterleitung und Abrechnung verarbeiten.',
    ],
  },
  {
    id: 'haftung',
    title: 'Haftung',
    paragraphs: [
      'Der Händler stellt Clever-Neuwagen von Ansprüchen Dritter frei, die aus fehlerhaften Händlerangaben oder rechtswidrigen Angeboten resultieren.',
      'Clever-Neuwagen haftet nicht für vertragliche Beziehungen zwischen Händler und Endkunde.',
    ],
  },
  {
    id: 'kuendigung',
    title: 'Kündigung',
    paragraphs: [
      'Ordentliche Kündigung gemäß Händlervereinbarung.',
      'Nach Beendigung der Zusammenarbeit werden Händlerdaten gemäß Datenschutzerklärung und gesetzlichen Aufbewahrungsfristen behandelt.',
    ],
  },
  {
    id: 'schluss',
    title: 'Schlussbestimmungen',
    paragraphs: [
      'Es gilt deutsches Recht.',
      'Änderungen dieser Nutzungsbedingungen werden dem Händler in Textform mitgeteilt.',
      `Stand: ${new Date().getFullYear()}`,
    ],
  },
];
