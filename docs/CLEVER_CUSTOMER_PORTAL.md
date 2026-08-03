# Clever Customer Portal – Persönlicher Angebotsraum & Shared Workspace

**Status:** v1 – Shared Conversational Workspace  
**Stand:** August 2026

## Leitsatz

Der Kunde öffnet nicht nur eine PDF.  
Er hat einen **persönlichen Clever-Angebotsraum**.

**WhatsApp überträgt Nachrichten. Clever versteht den Vorgang.**

Kunde und Verkäufer arbeiten mit demselben Clever-Kontext, aber mit unterschiedlichen Oberflächen.

## Golden Path Status (Phase 2, schmal)

Geschlossener Verkaufspfad (ein Loop, kein Big-Bang):

`Angebot vorbereiten → speichern → Kundenlink → Kunde öffnet/reagiert → Inbox/Composer-Seed → anpassen / nachfassen`

| Schritt | Status |
|---------|--------|
| Kundenlink / Portfolio senden | fertig |
| Öffnung → Portfolio `opened` + VehicleOffer `opened` + Inbox „Auswahl geöffnet“ | fertig |
| Reaktion Interesse / Ablehnung → Track + Inbox | fertig |
| Änderungswunsch → Inbox `offer_change_request` + Composer-Seed „Passe X an“ + Track-Feedback | fertig |
| Propose → Confirm → Action (kein Auto-Send) | Vertrag bleibt |
| WhatsApp-API / Admin-Leitstand / DMS | bewusst später |

Manuell (Brandes): Angebot → Link senden → Portal öffnen → „Änderung“ am XCeed → Clever Eingang „Angebot anpassen“ → Composer mit Seed → Review → Übernehmen.

Siehe auch [CLEVER_SELLER_ASSISTANT.md](CLEVER_SELLER_ASSISTANT.md) und Test `src/services/crm/goldenSalesPath.test.js`.

## Shared Customer Workspace

Der Chat ist der Vorgang: Nachrichten, Angebotskarten, Terminkarten, Dokumentanforderungen, Selbstauskunft und Status erscheinen chronologisch.

Strukturierte Tabs (Angebote / Unterlagen / Selbstauskunft) bleiben Übersichten über dieselben Daten.

Bei Terminvorschlägen kann der Kunde im Chat mit **„Ja, passt“** oder einem Alternativvorschlag antworten.  
Die Kalendereintragung bleibt Verkäufer-bestätigt – kein stilles Auto-Booking.

## Bottom Nav (Shell)

| Tab | Label-Beispiel |
|-----|----------------|
| Chat | Chat (Primäreinstieg) |
| Angebote | Angebote 2 |
| Unterlagen | Unterlagen 3/5 |
| Selbstauskunft | Selbstauskunft • |

## Was der Kunde erlebt

1. Sicherer Link (bestehender Kanal)
2. Chat mit Autohaus / Clever
3. Angebotskarten im Verlauf → digitale Offer View
4. Unterlagen hochladen / Selbstauskunft ausfüllen aus Chat-Karten
5. Angebotsraum-Aktionen: Gefällt mir / Frage / Änderung (ohne Leasing-Rechner)

Share-Copy: **„Ihre neuen Angebote sind online.“**

## Architektur (wiederverwendet)

| Baustein | Rolle |
|----------|--------|
| `customerMessageService.js` | Thread + Message + `kind` / `payload` |
| `sharedWorkspaceService.js` | Timeline, Workspace-Paket, Offer-Cards |
| `SharedWorkspaceChat.jsx` | Chat-UI |
| `customerOfferPortfolioService.js` | Portfolio / Events |
| `cleverUnterlagen.js` | Checklist / Upload |
| Self Disclosure Services | Formular + Status |

Kein zweites CRM. Kein paralleler Messenger-Store.

## Verwandt

- [CLEVER_MANIFEST.md](CLEVER_MANIFEST.md)
- [CLEVER_SELLER_ASSISTANT.md](CLEVER_SELLER_ASSISTANT.md)
- [CLEVER_CONVERSATION_UI.md](CLEVER_CONVERSATION_UI.md)
