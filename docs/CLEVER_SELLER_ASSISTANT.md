# Clever Seller Assistant

**Status:** v1 – Mobile-First Kundenakte  
**Stand:** Juli 2026

## Leitsatz

Clever ist kein CRM, das der Verkäufer bedienen muss.  
Clever ist der Assistent, dem der Verkäufer sagt, was für diesen Kunden erledigt werden soll.

Der Kunde sagt Clever, was ihm wichtig ist.  
Der Verkäufer sagt Clever, was erledigt werden soll.

## UX-Philosophie

Dashboard = **Kundenkontext + Clever + Action Result + letzte Aktivität**.

Nicht: zehn Menüs, Formulare, Copy/Paste, parallele ChatGPT-Nutzung.

Kundenkontext (customer_need) und Verkäufer-Notizen (seller_input) sind **klar getrennt**.

Nach Kundenreaktionen im Angebotsraum erscheint ein **Clever-Moment**  
(„… hat den EV3 angesehen und nach der Anhängelast gefragt“) mit  
Quick Action „Nachricht vorbereiten“ / „Angebot anpassen“.

Siehe [CLEVER_CUSTOMER_PORTAL.md](CLEVER_CUSTOMER_PORTAL.md).

## Komponenten

| Baustein | Datei |
|----------|--------|
| UI | `CustomerAkteSellerAssistant.jsx` |
| Intent | `sellerActionIntent.js` |
| Orchestrierung | `sellerAssistantOrchestrator.js` |
| Einbindung | `DealerAiLeadFollowUp.jsx` |

## Flow

1. Verkäufer tippt oder spricht (Mic).
2. Intent: `message_customer` | `prepare_offer` | `add_note` | `prepare_callback`.
3. Clever nutzt `buildCustomerUnderstanding` + `sellerInsights`.
4. Action Result mit **Seller Confirmation** (kein Auto-Send).
5. Bestehende Kanäle: Portal-Nachricht, WhatsApp-Deep-Link, mailto, Clever Nachrichten Sheet, Magic Offer / Offer-Pipeline.

## Source Awareness

| Wert | Typische Source |
|------|-----------------|
| Schwarzmetallic verfügbar | `seller_input` |
| Terracotta interessant | `customer_need` |
| 15.000 km | `customer_need` |
| Anhängelast kg | nur `verified_vehicle_data` – sonst keine Zahl erfinden |

Verkäufernotiz ≠ Kundenwunsch.

## Kein Inventar

„Ich habe einen schwarzen EV3 da“ = Seller Fact für diesen Vorgang.  
Kein DMS-/Bestandsabgleich in v1.

## Verwandt

- [CLEVER_MANIFEST.md](CLEVER_MANIFEST.md)
- [CLEVER_CONVERSATION_UI.md](CLEVER_CONVERSATION_UI.md)
- [CLEVER_CUSTOMER_PORTAL.md](CLEVER_CUSTOMER_PORTAL.md)
- [CLEVER_MAGIC_OFFER.md](CLEVER_MAGIC_OFFER.md)
- Seller Copilot: `runCleverSellerCopilot.js`
