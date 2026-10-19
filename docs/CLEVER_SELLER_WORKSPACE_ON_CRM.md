# Clever auf dem Händler-CRM

**Status:** FREEZE – verbindlich ab 19. Oktober 2026  
**Geltung:** Produkt, Architektur, jede neue Funktion

Quelle der Wahrheit für die Systemgrenze zwischen Kia-CRM und Clever.

---

## Satz

> Clever ersetzt nicht das Händler-CRM. Clever bedient es für den Verkäufer und führt den Verkaufsprozess bis zum Abschluss.

Salesforce weiß, wer der Kunde ist. Clever hilft dem Verkäufer, mit ihm ein Auto zu verkaufen.

| System | Rolle |
|--------|--------|
| **Kia Salesforce / MySales** | System of Record. Kunde, Kontaktdaten, Leads, Historie, Marketing, Reklamationen, zentrale Kia-Daten, Rechte. |
| **Clever** | Seller Workspace / AI-Verkaufsschicht. Gespräch erfassen, Kundenwunsch verstehen, Fahrzeug wählen, Angebot vorbereiten, PDF übernehmen, Kundenportal, Reaktion verstehen, nächsten Schritt ausführen. |

Händler werden Salesforce nutzen müssen. Clever überzeugt sie nicht, das CRM zu ersetzen. Clever macht Salesforce für den Verkäufer benutzbar.

Salesforce beschreibt denselben Schnitt selbst: AIforce und das Headless Toolkit (MCP, APIs, Entwicklertools) sollen Salesforce-Daten, Workflows, Identitäten und Berechtigungen in eigene Oberflächen bringen. Ob Kia Händlern diesen Zugriff gibt, ist offen. Die Richtung passt.

---

## Zwei Oberflächen, eine Grenze

Der Kundendialog bleibt Verständnis: Gespräch, zwei Welten, Clever Lead. Siehe [Vier Aufgaben](CLEVER_FOUR_TASKS.md) und [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md).

Der Verkäufer-Workspace führt den Verkauf: Diktat, Draft, PDF, Angebot, Kunde, Reaktion, Änderung, Abschluss. Siehe [UX Manifest V1](CLEVER_UX_MANIFEST_V1.md).

Persönlicher Kontext („verheiratet, zwei Kinder, Kaffee schwarz“) bleibt kompakter Kontext. Clever zerlegt ihn nicht in ein eigenes CRM-Schema.

---

## Kurs

1. **Owned Demand MVP V1 ist pilotfähig und eingefroren.** Eigene Vermarktung erzeugt den Lead. Keine weiteren Features auf diesem Stand, bis der UI-Pilot einmal durch ist.
2. **Verkaufsloop bleibt unverändert.** Ab dem Concept Draft: PDF, Angebot, Kunde, Reaktion, Änderung, Abschluss.
3. **Salesforce / MySales wird nicht nachgebaut und ist gerade nicht die nächste Baustelle.** Anbinden später, nicht vorher.
4. **Händler-Satz.** „Wir behalten Salesforce. Clever macht den eigenen Bestand für den Verkäufer verkaufbar.“

---

## Owned Demand MVP V1 — pilotfähig

**Status:** FREEZE, 19. Oktober 2026

Eine veröffentlichte Händlerkondition bleibt durchgängig erhalten:

Dealer Condition → Fahrzeugseite → Lead → Concept Draft → bestehender Offer Flow

| Regel | Bedeutung |
|--------|-----------|
| Rabatt einmal | `publishOwnedVehicleOffer` schreibt `discountsByModel` und `paymentDiscounts` |
| Dieselbe Kondition | Seite, Lead und Concept Draft tragen denselben Wert |
| Web-Schätzrate | bleibt Anzeige, `monthlyRateAuthority: display_estimate` |
| Rate | `null`, bis PDF oder Calculator die Authority liefert |
| Offer Loop | PDF, VehicleOffer, Portfolio, Kundenlink, Reaktion, Abschluss bleiben unverändert |
| Salesforce / CRM | kein Ausbau in diesem Freeze |

UI-Einstieg: bestehende Fahrzeugverwaltung, Aktion „Veröffentlichen“. Sie ruft nur `publishOwnedVehicleOffer` auf. Kein zweites Lager, kein zweites Formular, keine zweite Rabattquelle.

Code: `src/services/dealer/ownedDemandListing.js` · Golden: `ownedDemandListing.golden.test.js`

---

## Verkaufsloop (bestehender Code)

Dieser Loop ist das Produkt. Neue Arbeit härtet ihn. Sie erweitert ihn nicht um CRM-Module.

| Schritt | Heute in Clever |
|---------|-----------------|
| Diktat / Dump | `interpretSellerInput`, Zero-Loss (`zeroLossIntake.js`) |
| Entwurf | Working Draft, `offerDrafts` (`cleverWorkingDraft.js`) |
| PDF in denselben Draft | `offerDraftIntakeMerge.js` |
| Angebot | `materializeVehicleOfferFromOfferDraft`, `crm.vehicleOffers` |
| Kunde / Link | `customerLinkOfferService`, `customerOfferPortfolio` |
| Reaktion | Portal-Event → Inbox → Track (`goldenSalesPath`) |
| Änderung | Änderungswunsch zurück in „Angebot anpassen“ |
| Nächster Schritt | `determineNextBestSellerAction` |

Architektur-Freezes darunter bleiben: Working Draft, Zero-Loss, Vehicle Identity, Capture-then-Offer, Offer Intake, Dual Input / Single State.

---

## Integrations-Audit

Stand: Clever hält den Kunden heute lokal auf dem Lead (`name`, `contact`, `crm.*`). Es gibt keine MySales-Anbindung. Die folgende Zuordnung ist die Soll-Grenze. Salesforce-Objektnamen sind Annahmen, bis das Kia-Objektmodell vorliegt.

### Lesen — Salesforce ist Master

Clever braucht diese Daten, um den Verkauf zu starten. Clever pflegt sie nicht als zweite Wahrheit.

| Bedarf | Heute lokal | Soll-Quelle (Annahme) |
|--------|-------------|------------------------|
| Wer | `lead.name`, `lead.contact` (Telefon, E-Mail, PLZ, bevorzugter Kontakt) | Contact / Account |
| Welcher Vorgang | `lead.id`, `lead.status`, `lead.source` | Lead oder Opportunity, plus Owner |
| Kia-Kundennummer / externe Id | fehlt | stabiler Fremdschlüssel |
| Bestand / Vertrag, den Kia schon kennt | `crm.customerContracts` | Contract / Asset, nur lesen |
| Frühere Käufe und zentrale Historie | `history`, `crm.activities` | Activity History, nur lesen |
| Einwilligung, Dublette | lokal nicht maßgeblich | Salesforce |

Ohne Lesezugriff bleibt Clever ein lokaler Arbeitsstand. Der Verkäufer legt den Kunden dann weiter von Hand an. Das ist der Pilot-Zustand, nicht das Zielbild.

### Zurückschreiben — Ergebnis des Verkaufs, nicht der Kundenstamm

Clever schreibt Ergebnisse, die im Händler-CRM sichtbar sein müssen. Clever schreibt keine 30 Einzelfelder für Familienkontext.

| Ergebnis | Heute lokal | Zurück (Annahme) |
|----------|-------------|------------------|
| Angebot liegt vor | `crm.vehicleOffers` (Modell, Konditionen, Status, PDF-Referenz) | Opportunity-Stufe oder Quote-Referenz plus Anhang, wenn die API Dateien erlaubt |
| Angebot gesendet, geöffnet, Änderung, Absage | Portfolio-Status, Inbox, `vehicleTrack` | Activity: kurzer Satz plus Fahrzeug und Konditionen |
| Änderungswunsch im Wortlaut | `customerReaction.questionText` | dieselbe Activity, Text behalten |
| Termin / Follow-up, den der Verkäufer bestätigt | Aktivitäten | Task |
| Abschluss | Track- und Offer-Status | Opportunity geschlossen, mit Verweis auf das Clever-Angebot |
| Verknüpfung | fehlt | Clever-`offerDraftId` / `vehicleOffer.id` ↔ Salesforce-Id |

Eine Activity ist ein Satz, den ein Kollege in Salesforce lesen kann: „EV3 Earth, Leasing 48 Monate, 15.000 km, 5.000 € Anzahlung, Link gesendet.“ Der Working Draft wandert nicht als JSON ins CRM.

### Lokal und transient — bewusst nicht synchronisieren

| Inhalt | Ort heute | Warum es lokal bleibt |
|--------|-----------|------------------------|
| Unfertiger Entwurf, offene Trim/Farbe/Paket-Kandidaten | `offerDrafts` | Arbeit, noch kein Angebot |
| Diktat-Rohtext, `unresolved_note`, nicht verbrauchte Spans | Zero-Loss | Erinnerung für den Verkäufer, kein Stammdatum |
| Persönlicher Kontext | `crm.sellerInsights`, Notizen | kompakter Kontext; optional ein Notiz-Blob, nie ein Feld pro Lebensdetail |
| Wunschbudget ohne Bankrate | Capture-then-Offer | Budget ist keine Angebotsrate |
| Composer-Session, Klärung, NBA | Working State | Ablauf, kein Record |
| Portal-Token, Inbox-Routing | Portal / Inbox | Zustellung |
| Interpret-Sicherheit, Alias-Normalisierung | Intake | intern |

`crm.needProfile` und der Clever Lead sind das Verständnis für den Verkäufer. Sie werden zur Activity oder zum Angebotsbezug verdichtet, sobald etwas gesendet oder abgeschlossen wird. Sie werden nicht Feld für Feld zum Kundenstamm.

### Stop-Liste

Nicht bauen, auch nicht „erst mal lokal, später sync“:

- Marketing-Automation, Kampagnen, Journeys
- Lead-Scoring und Forecasting
- Reklamations- und Case-Verwaltung
- Dubletten-Master und eigene 360°-Datenbank
- Schema-Builder, Custom-Object-CRM, Pipeline als Akte-Hauptfläche

Das steht bereits im [UX Manifest](CLEVER_UX_MANIFEST_V1.md). Dieses Dokument macht es zur Systemgrenze gegenüber Kia.

---

## Vor jedem größeren Ausbau klären

1. Gibt Kia oder der Händler API-Zugriff (REST, Headless Toolkit, MCP) — oder nur Export, Bericht, manuelle Übergabe?
2. Welche Objekte sind Lead, Kunde, Opportunity, Angebot?
3. Darf eine Drittanwendung Activities, Tasks und Dateien schreiben? Unter wessen Benutzer und Rechten?
4. Welcher Schlüssel verbindet einen Clever-Lead mit Salesforce (Salesforce-Id, Kia-Kundennummer, E-Mail)?
5. Dürfen Angebots-PDF und Kundenportal-Link außerhalb von Salesforce liegen?
6. Sandbox: welcher Händler kann einen Lese- und einen Schreibversuch freigeben?

Solange 1–4 offen sind, bleibt der Verkaufsloop lokal vollständig. Es wird kein zweiter Kundenstamm „für die Übergangszeit“ ausgebaut.

---

## Verweise

- Rule: `.cursor/rules/clever-seller-workspace-on-crm.mdc`
- [UX Manifest V1](CLEVER_UX_MANIFEST_V1.md)
- [Vier Aufgaben](CLEVER_FOUR_TASKS.md)
- [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md)
- [Leitsatz](../PRINCIPLE.md)
- Salesforce, öffentlich: [Artificial Intelligence](https://www.salesforce.com/de/artificial-intelligence/)
