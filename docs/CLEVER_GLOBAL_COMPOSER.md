# Clever Global Composer

**Status:** Slice 4 (verifiziertes Fahrzeugwissen + natürliche Kundennachricht)  
**Stand:** Juli 2026

## Produktgesetz

> **Der Composer ist Clever.**

Der Clever Composer ist die universelle Bedienoberfläche für das Verkäufer-CRM.
Der Verkäufer formuliert sein Ziel. Clever wählt kontextabhängig bestehende Tools.

> **Der globale Composer wählt bestehende Tools kontextabhängig aus.**

> **Das Lexikon ist ein Werkzeug hinter Clever**, kein notwendiger separater Arbeitsweg.

> **OpenAI schreibt. Clever beschafft und validiert die Fakten.**

> **Globale Wissensfragen verändern keine Kundenakte.**

> **Clever ist das Gedächtnis des Verkäufers.**

> **Ein Verkäuferauftrag ist keine Kundennachricht** – Seller-Befehle landen nie im Kundentext.

> **Seller Facts ≠ Customer Truth** – Farbe, Paket und Schiebedach aus dem Verkäuferbefehl werden nicht automatisch als Kundenwunsch gespeichert.

## Surfaces

| Surface | Verhalten |
|---------|-----------|
| Dashboard (`/backend`) | `CleverGlobalComposer` aktiv |
| Kundenakte | bestehender Composer bleibt; Global Composer ausgeblendet |

### Context Stack

- Sync: Kundenakte setzt `currentCustomer` aus der Route
- Reset beim Verlassen der Akte
- Handoff: Prepared Offer / Knowledge-Message als `attachedWorkingObjects` (Working State, keine Customer Truth)
- Message-Edit: `customer_message_edit` – kein erneuter Universal-Turn beim Tippen

### Orchestrierung

Nur `runCleverSellerTurn()`:

| Feld | Slice |
|------|-------|
| `todayOverview`, `knowledgeResult` | 1 |
| `customerSearchResults`, `customerSummary`, `historySearchResults` | 2 |
| `handoffWorkingContext`, combined Offer+Message Review | 3 |
| `sellerFacts`, grounded `knowledgeResult`, `knowledge_and_message_review` | 4 |

## Slice 4 – Golden Flow

Input:

> „Schreib Garritano, dass wir einen schwarzen Picanto GT-Line mit Technologie-Paket und Schiebedach da haben. Erklär ihm kurz das Technologie-Paket und die Ausstattung.“

Ablauf:

1. `find_customer` → Garritano
2. `resolve_vehicle` → Picanto GT-Line
3. Seller Facts (Farbe, Verfügbarkeit, Paket, Schiebedach) getrennt von Customer Truth
4. `lookup_vehicle_package` / `lookup_vehicle_equipment` über verifizierte Quellen
5. Fehlendes Paketwissen → Warnung, keine erfundenen Inhalte
6. Grounded Message Writer (Fallback / OpenAI)
7. Fact-Preservation + Seller-Befehl-Validator
8. Review `knowledge_and_message_review`
9. Handoff: Kundenakte + `customer_message_edit`
10. Kein Auto-Send

Gegenproben:

- Kurze Verfügbarkeit ohne Paket → keine Paketdetails erfinden
- Technologie-Paket ohne Fahrzeug → gezielte Variantenfrage
- „serienmäßig Schiebedach“ gegen verifizierte Daten → Warnung
- „wegen der Unterlagen“ → keine irrelevanten Fahrzeugdetails

## Feature-Flag

`VITE_CLEVER_GLOBAL_COMPOSER=false` deaktiviert den Global Composer.

## Tests

- `globalComposer.slice1.test.js`
- `globalComposer.slice2.test.js`
- `globalComposer.slice3.test.js`
- `globalComposer.slice4.test.js`

## Nächste Slices

Termine, Kaufangebot parallel, Attachments, schrittweise Akte-Composer-Migration.
