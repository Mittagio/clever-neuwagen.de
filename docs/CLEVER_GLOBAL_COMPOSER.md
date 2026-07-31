# Clever Global Composer

**Status:** Slice 2 (Customer Find · Context · History)  
**Stand:** Juli 2026

## Produktgesetz

> **Der Composer ist Clever.**

Der Clever Composer ist die universelle Bedienoberfläche für das Verkäufer-CRM.
Der Verkäufer formuliert sein Ziel. Clever wählt kontextabhängig bestehende Tools.

> **Der globale Composer wählt bestehende Tools kontextabhängig aus.**

> **Das Lexikon ist ein Werkzeug hinter Clever**, kein notwendiger separater Arbeitsweg.

> **Globale Wissensfragen verändern keine Kundenakte.**

> **Clever ist das Gedächtnis des Verkäufers** – Suche in CRM-, Offer-, Activity- und Conversation-Daten, nichts erfinden.

## Surfaces

| Surface | Verhalten |
|---------|-----------|
| Dashboard (`/backend`) | `CleverGlobalComposer` aktiv |
| Kundenakte | bestehender Composer bleibt; Global Composer ausgeblendet (kein Doppel-Composer) |

### Context Stack

`CleverComposerContext` in `src/context/CleverComposerContext.jsx`:

- `routeContext`, `currentCustomer`, Tracks/Offer/Document/Conversation
- `attachedWorkingObjects`, `pendingAction`, `dashboardContext`, `leadsSnapshot`
- Sync: Kundenakte setzt `currentCustomer` aus der Route
- Reset beim Verlassen der Akte (Dashboard behält keinen Kunden)

### Orchestrierung

Nur `runCleverSellerTurn()` – erweitert um:

- `scope` (`dashboard` | `global` | `customer`)
- `todayOverview`, `knowledgeResult` (Slice 1)
- `customerSearchResults`, `customerSummary`, `historySearchResults` (Slice 2)
- `searchResults` (Alias auf History/Customer-Treffer)

## Slice 1 – Golden Flows

1. **„Was liegt heute an?“** → `getTodayOverview`
2. **„XCeed Anhängelast?“** → verifizierte Facts

## Slice 2 – Golden Flows

| Input | Tool / Ergebnis |
|-------|-----------------|
| „Öffne Herrn Brandes.“ | `open_customer` → Kundenkarte + Navigation |
| „Was wollte Herr Brandes noch einmal?“ | `summarize_customer_context` → Understanding/Tracks |
| „Was hatte ich Garritano zur Lieferzeit geschrieben?“ | `search_customer_history` → gesendete Nachricht |
| „Wann habe ich Frau Deutsche zuletzt ein Angebot geschickt?“ | `search_customer_offers` → Offer-Sent-Event |
| „Finde den Kunden mit dem roten Sportage und AHK.“ | `find_customer` → Attribute über Customer Truth |

Suche ist deterministisch (`customerSearchService`, `composerAkteSearch`, Messages, `vehicleOffers`).  
OpenAI darf Absicht/Normalisierung unterstützen – **nie** Treffer erfinden.

### Review-Typen (Slice 2)

`customer_search_results` · `customer_summary` · `history_search_results` · `offer_history_result` · `no_search_result`

### Navigation

`/backend/kundenakte/:id?messageId=&offerId=` – Highlight über bestehendes Akte-Verhalten.

## Feature-Flag

`VITE_CLEVER_GLOBAL_COMPOSER=false` deaktiviert den Global Composer.

## Tests

- `src/services/cleverSeller/globalComposer.slice1.test.js`
- `src/services/cleverSeller/globalComposer.slice2.test.js`

## Nächste Slices

Offer/Message Multi-Action, Appointment, Attachments, schrittweise Akte-Composer-Migration.
