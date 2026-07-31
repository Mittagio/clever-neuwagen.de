# Clever Global Composer

**Status:** Slice 3 (Kunde → Angebot → Nachricht)  
**Stand:** Juli 2026

## Produktgesetz

> **Der Composer ist Clever.**

Der Clever Composer ist die universelle Bedienoberfläche für das Verkäufer-CRM.
Der Verkäufer formuliert sein Ziel. Clever wählt kontextabhängig bestehende Tools.

> **Der globale Composer wählt bestehende Tools kontextabhängig aus.**

> **Das Lexikon ist ein Werkzeug hinter Clever**, kein notwendiger separater Arbeitsweg.

> **Globale Wissensfragen verändern keine Kundenakte.**

> **Clever ist das Gedächtnis des Verkäufers.**

> **Ein Verkäuferauftrag ist keine Kundennachricht** – Seller-Befehle landen nie im Kundentext.

## Surfaces

| Surface | Verhalten |
|---------|-----------|
| Dashboard (`/backend`) | `CleverGlobalComposer` aktiv |
| Kundenakte | bestehender Composer bleibt; Global Composer ausgeblendet |

### Context Stack

- Sync: Kundenakte setzt `currentCustomer` aus der Route
- Reset beim Verlassen der Akte
- Handoff: Prepared Offer als `attachedWorkingObjects` (Working State, keine Customer Truth)

### Orchestrierung

Nur `runCleverSellerTurn()`:

| Feld | Slice |
|------|-------|
| `todayOverview`, `knowledgeResult` | 1 |
| `customerSearchResults`, `customerSummary`, `historySearchResults` | 2 |
| `handoffWorkingContext`, combined Offer+Message Review | 3 |

## Slice 3 – Golden Flow

Input:

> „Erstelle Herrn Garritano ein Angebot für den Picanto GT-Line für 17.000 €.“

Ablauf:

1. `find_customer` → Garritano aus `leadsSnapshot`
2. `buildCustomerUnderstanding` laden
3. Picanto GT-Line + Kaufpreis 17.000 € (`offerType: cash`)
4. `prepare_offer` (Prepared Action, `needsSellerConfirmation`)
5. `draft_customer_message` (Seller-Befehl-Validator)
6. Review `offer_and_message_review`
7. Handoff: Kundenakte + Working Context „Picanto GT-Line · Kauf · 17.000 €“
8. Kein Auto-Send, keine Customer-Truth-Mutation

Gegenproben:

- Leasing ohne Rate → missing, keine erfundene Rate
- „Schreib … dass … kostet“ → nur Message
- „Picanto GT-Line 17.000 €“ → Rückfrage Angebot vs. Nachricht

## Feature-Flag

`VITE_CLEVER_GLOBAL_COMPOSER=false` deaktiviert den Global Composer.

## Tests

- `globalComposer.slice1.test.js`
- `globalComposer.slice2.test.js`
- `globalComposer.slice3.test.js`

## Nächste Slices

Termine, Attachments, schrittweise Akte-Composer-Migration.
