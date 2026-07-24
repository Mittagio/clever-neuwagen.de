# Clever Customer Portal – Persönlicher Angebotsraum

**Status:** v1 – verbunden mit Seller Assistant  
**Stand:** Juli 2026

## Leitsatz

Der Kunde öffnet nicht nur eine PDF.  
Er hat einen **persönlichen Clever-Angebotsraum**.

Kunde und Verkäufer arbeiten mit demselben Clever-Kontext, aber mit unterschiedlichen Oberflächen.

## Was der Kunde erlebt

1. Sicherer Link (bestehender Kanal: E-Mail / WhatsApp / App-Link)
2. Start: „Hallo … 👋“ · **Ihre Angebote**
3. Mehrere Angebotskarten (kein 40-Spalten-Vergleich)
4. Detailaktionen:
   - **Das gefällt mir** → `portfolio_offer_interested` / Inbox `offer_interested`
   - **Dazu habe ich eine Frage** → Offer-Kontext-Chat / `offer_question`
   - **Ich möchte etwas ändern** → `portfolio_offer_change_request` (**keine** Kunden-Leasing-Neuberechnung)
5. Optional: Originalangebot (PDF), nur wenn vorhanden

Share-Copy an Kunden: **„Ihre neuen Angebote sind online.“** – nicht „Hier ist Ihre PDF.“

## Bottom Nav (Shell)

Bestehendes Portal-Shell-Pattern:

| Tab | Label |
|-----|--------|
| Angebote | Angebote |
| Messages | Chat mit Clever |
| Documents | Unterlagen |
| Advisor | Profil |

## Rückfluss zum Verkäufer

Events fließen in Inbox + Lead-History + `customerOfferInteractions`.

In der Verkäufer-Kundenakte zeigt `buildSellerCleverMoment()` z. B.:

> EV3 interessiert Herrn Notz besonders. Er hat nach der Anhängelast gefragt.

Quick Actions: **Nachricht vorbereiten** · **Angebot anpassen**

## Architektur (wiederverwendet)

| Baustein | Rolle |
|----------|--------|
| `customerOfferPortfolioService.js` | Portfolio, Events, Share-Copy |
| `CustomerOfferPortfolioPage.jsx` | Kunden-UI |
| `customerOfferInteraction.js` | Interest / Questions |
| `cleverInboxService.js` | Verkäufer-Eingang |
| `sellerAssistantOrchestrator.js` | Clever-Moment + Seller Turns |
| `customerPortalShellPresenter.js` | Nav / Shell |

Kein zweites CRM. Kein Kunden-Kalkulator. Kein Match-Score.

## Verwandt

- [CLEVER_MANIFEST.md](CLEVER_MANIFEST.md)
- [CLEVER_SELLER_ASSISTANT.md](CLEVER_SELLER_ASSISTANT.md)
- [CLEVER_CONVERSATION_UI.md](CLEVER_CONVERSATION_UI.md)
