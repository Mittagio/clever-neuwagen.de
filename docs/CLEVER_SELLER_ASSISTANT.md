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
| Shared Chat | `CustomerAkteSharedWorkspace.jsx` |
| Intent | `sellerActionIntent.js` |
| Orchestrierung | `sellerAssistantOrchestrator.js` |
| Workspace | `sharedWorkspaceService.js` |
| Einbindung | `DealerAiLeadFollowUp.jsx` |

## Flow

1. Verkäufer tippt oder spricht (Mic).
2. Intent: `message_customer` | `prepare_offer` | `request_documents` | `add_note` | `prepare_callback`.
3. Clever nutzt `buildCustomerUnderstanding` + offene Unterlagen.
4. Action Result / **Workspace-Paket** (Nachricht + Dokument-/SA-Karten) mit Seller Confirmation.
5. Bestehende Kanäle: Shared Workspace Thread, Portal, WhatsApp-Deep-Link, mailto, Magic Offer.

## Shared Workspace (Verkäufer)

In der Kundenakte: `CustomerAkteSharedWorkspace` zeigt denselben Verlauf wie der Kunde.

Clever Review vor Send:

✨ Clever hat vorbereitet  
Nachricht + ✓ Selbstauskunft / ✓ Gehaltsnachweis  
[ Senden ]

Siehe [CLEVER_CUSTOMER_PORTAL.md](CLEVER_CUSTOMER_PORTAL.md).

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
