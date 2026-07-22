# Clever Dealer Plugin

Clever als eingebettete digitale Verkaufstheke auf Händlerwebseiten.

## Mission

Der Kunde ist bereits beim Händler. Clever soll ihn nicht auf eine zweite Reise schicken, sondern den bestehenden Besuch intelligenter machen.

Clever arbeitet zunächst **ohne Händlerbestand** mit:

- Seitenkontext (Page Context)
- Fahrzeug-/Modellwissen
- Kundenwünschen (Notizzettel)
- Gesprächsverlauf
- Wunschübergabe
- Soft Wish Enrichment vor Identifikation
- Händlerkontakt (WhatsApp / Telefon)
- Session Resume
- Händlerbranding

## Keine Bestandsintegration

Ausdrücklich **nicht** Bestandteil dieses Plugin-Standes:

- Bestandsabfrage / Lagerfahrzeuge
- Matching gegen Händlerbestand
- Bestands-APIs / -Importe
- Verfügbarkeits- oder Preiskarten aus dem Lager

## Drei Ebenen (strikt getrennt)

| Ebene | Bedeutung |
|-------|-----------|
| **Page Context** | Woher der Kunde kommt (Seite, Modell, Kampagne) – **kein** Kundenwunsch |
| **Notizzettel** | Was der Kunde gesagt, bestätigt oder ausgewählt hat |
| **Next Topics** | Gesprächsnavigation – kein `needProfile`-Patch |

Beispiel: EV9-Modellseite setzt `modelKey`, erzeugt aber **nicht** automatisch „EV9 interessant“.

## Page Context

Laufzeitkontext (keine neue Kundenwahrheit):

- `dealerId`, `brandKey`, `pageType`, `modelKey`, `variantKey`
- `campaign`, `utmSource`, `purchaseTypeHint`, `returnUrl`

`pageType`: `dealer_home` | `model` | `campaign` | `generic`

Implementierung: `src/services/consultation/cleverDealerPluginContext.js`

## Meine Wünsche weitergeben

Primärer CTA: **Meine Wünsche weitergeben** (ab erstem Kundenturn).

Flow: Soft Wish Enrichment (optional) → E-Mail → Code → Erfolg.

Kein Zwang zu vollständiger Bedarfsermittlung. Details: [CLEVER_CUSTOMER_INTAKE_MANIFEST.md](./CLEVER_CUSTOMER_INTAKE_MANIFEST.md)

Wenn der Notizzettel Substanz hat, bleibt weiterhin **nur dieser eine** sticky CTA.
Keine zweite Soft-Prompt-Box mit demselben Button (Doppel-CTA im Embed vermeiden).

## Escape-Kanäle

WhatsApp-/Anruf-Shortcuts sind im öffentlichen Chat-UI **nicht** aktiv
(„Lieber direkt sprechen“ würde mit der Wunschübergabe konkurrieren).

Kontakt läuft über Soft Wish Enrichment und **E-Mail-Anmeldung auf der Clever-Plattform**
(Code-Login). KD und VK sprechen anschließend in Clever weiter.
Die Escape-Helfer (`cleverDealerPluginEscape.js`) bleiben für spätere Einbindung verfügbar.

## Session Resume

Lokaler Fortschritt in `localStorage` (`clever-dealer-plugin-session:{dealerId}`).

- Resume-Moment: „Willkommen zurück“ → Weiter / Neu starten
- Cross-Model: Hinweis möglich, **kein** automatischer neuer Modellwunsch
- „Später weitermachen“ sichert die Session auf dem Gerät

Consent: notwendige Session an Host-/Essential-Consent anbindbar (`hostConsent.functional`).

## Dealer Branding

Händler im Vordergrund: Name, optional Logo/Accent, Ansprechpartner, Telefon/WhatsApp, Öffnungszeiten nur wenn verifiziert.

Klein: „Unterstützt durch Clever“.

## Success Screen

Nach erfolgreicher Weitergabe keine Sackgasse:

- „Ihre Wünsche sind angekommen“ + kompakte Wunschchips
- Rückkehr über `returnUrl` / Modellkontext
- „Noch etwas ergänzen“ öffnet das Gespräch wieder

## Safe Intake

Bei AI-Ausfall bleiben Notizzettel, Session, Soft Wish Enrichment (Fallback-Chips/Freitext) und Escape-Kanäle erhalten.

## Mobile Embed

Zielbreiten 390–430 px: sticky Notizzettel/Composer, Hero auf Modellseiten verkürzt, keine doppelten Scroll-Fallen, safe-area beachten.

## Verwandte Dateien

- `cleverDealerPluginContext.js` / `Session.js` / `Escape.js` / `Branding.js`
- `CleverConversationExperience.jsx` (`embedded`, `pageContext`, `hostConsent`)
- Tests: `cleverDealerPlugin.test.js`
