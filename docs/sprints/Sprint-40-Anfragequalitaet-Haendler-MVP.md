# Sprint 40 – Anfragequalität & Händler-MVP

## Ziel

**Anfragequalität statt Anfrageanzahl.** Der Händler erhält einen strukturierten Berater-Brief – nicht „Kunde interessiert sich für EV3“.

## Händler-Brief (Gold-Standard)

- Kundenname
- CleverQuote % (+ Snapshot für Nachvollziehbarkeit)
- Budget
- Wünsche ✓ / optional +
- Empfohlenes Fahrzeug
- Alternativen mit %
- Gewählte Variante (Laufzeit, km, Rate)
- Lieferzeit

## Umsetzung

| Datei | Änderung |
|-------|----------|
| `dealerInquiryBrief.js` | `buildDealerInquiryBrief`, Snapshot, Preview |
| `marketplaceLeadService.js` | Lead mit `inquiryBrief`, `cleverQuotePercent`, `budgetMax` |
| `DealerInquiryBriefView.jsx` | Shared UI Kunde + Händler |
| `InquirySummaryModal.jsx` | Brief-Vorschau vor Senden |
| `VehicleDetailPage.jsx` | Brief beim Submit |
| `LeadListItem.jsx` | Name · Fahrzeug · CQ % · Budget |
| `LeadDetail.jsx` | Clever-Zusammenfassung-Karte |

## Erfolgskriterium

1. Kunde sieht vor „Anfrage senden“ **dieselbe** Struktur wie der Händler.
2. Lead-Liste: **Herr Müller · EV3 Earth · 96 % · Budget 350 €** auf einen Blick.
3. Lead-Detail: Wünsche, Optional, Alternativen – ohne Fließtext-Rätselraten.
4. CleverQuote-Snapshot ist **eingefroren** zum Anfragezeitpunkt.

## Status

- [x] `buildDealerInquiryBrief`
- [x] Lead-Payload erweitert
- [x] Kunden-Vorschau = Händler-Brief
- [x] Händler Lead-Liste + Detail

**Sprint 40 abgeschlossen.**
