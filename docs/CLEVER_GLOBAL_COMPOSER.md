# Clever Global Composer

**Status:** Slice 1 (Dashboard + Vehicle Knowledge)  
**Stand:** Juli 2026

## Produktgesetz

> **Der Composer ist Clever.**

Der Clever Composer ist die universelle Bedienoberfläche für das Verkäufer-CRM.
Der Verkäufer formuliert sein Ziel. Clever wählt kontextabhängig bestehende Tools.

> **Das Lexikon ist ein Werkzeug hinter Clever**, kein notwendiger separater Arbeitsweg.

> **Globale Wissensfragen verändern keine Kundenakte.**

## Slice 1

| Surface | Verhalten |
|---------|-----------|
| Dashboard (`/backend`) | `CleverGlobalComposer` aktiv |
| Kundenakte | bestehender Composer bleibt; Global Composer ausgeblendet (kein Doppel-Composer) |

### Context Stack

`CleverComposerContext` in `src/context/CleverComposerContext.jsx`:

- `routeContext`, `currentCustomer`, Tracks/Offer/Document/Conversation
- `attachedWorkingObjects`, `pendingAction`, `dashboardContext`, `leadsSnapshot`
- Reset beim Verlassen der Akte (Dashboard behält keinen Kunden)

### Orchestrierung

Nur `runCleverSellerTurn()` – erweitert um:

- `scope` (`dashboard` | `global` | `customer`)
- `todayOverview` (Tool `get_today_overview`)
- `knowledgeResult` (Tool `lookup_vehicle_technical_fact`)

### Golden Flows

1. **„Was liegt heute an?“** → `getTodayOverview` aus Reminder/Journey/Worklist/Golden Moment  
2. **„XCeed Anhängelast?“** → verifizierte Facts (`getVerifiedVehicleFacts`), Quelle anzeigen

## Feature-Flag

`VITE_CLEVER_GLOBAL_COMPOSER=false` deaktiviert den Global Composer.

## Nächste Slices

Shell ausweiten, Historie-Suche, Offer/Message Multi-Action, Appointment, Attachments.
