# Clever Customer Portal – Persönlicher Angebotsraum & Shared Workspace

**Status:** v1 – Shared Conversational Workspace  
**Stand:** Juli 2026

## Leitsatz

Der Kunde öffnet nicht nur eine PDF.  
Er hat einen **persönlichen Clever-Angebotsraum**.

**WhatsApp überträgt Nachrichten. Clever versteht den Vorgang.**

Kunde und Verkäufer arbeiten mit demselben Clever-Kontext, aber mit unterschiedlichen Oberflächen.

## Shared Customer Workspace

Der Chat ist der Vorgang: Nachrichten, Angebotskarten, Dokumentanforderungen, Selbstauskunft und Status erscheinen chronologisch.

Strukturierte Tabs (Angebote / Unterlagen / Selbstauskunft) bleiben Übersichten über dieselben Daten.

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
