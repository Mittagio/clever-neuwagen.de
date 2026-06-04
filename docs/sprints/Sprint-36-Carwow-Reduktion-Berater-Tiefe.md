# Sprint 36 – Carwow-Reduktion, Berater-Tiefe

## Ziel

Carwow wirkt stark durch **Reduktion**, Clever-Neuwagen durch **Erklärung**.
Dieser Sprint schärft Ebene 1 (Emotion) und Ebene 2 (Berater-USP).

**Merksatz:** Nicht „225 Modelle gefunden“ – sondern **„225 geprüft – hier die 5 besten“**.

---

## Ebene 1 (sichtbar)

| Element | Regel |
|---------|--------|
| Bild | Groß, edge-to-edge |
| Name | Modell ohne Trim (kein Earth/GT-Line) |
| CleverQuote | Prominent |
| Preis | **Ein** Hero-Preis (Leasing oder Kauf) |
| Warum | Wunsch-Bullets (Sitzheizung, Kamera, …) |
| CTA | **Eine** Hauptaktion: Angebot ansehen |
| Sekundär | „Ausstattung verstehen“ → Ebene 2 |

**Nicht in Ebene 1:** Händler, Lieferzeit, 3 Dock-Buttons, Trim-Namen, Paket-Codes.

---

## Ebene 2 (Klick)

CleverQuote-Breakdown in Berater-Sprache:

- **Bereits enthalten** (Serie)
- **Fehlt**
- **Mit Paket möglich**
- **Lösung:** Paketname + Impact (+€/Monat)

---

## Ergebnisseite

- Zeile: „225 Fahrzeuge geprüft – hier die besten 5“
- Treffer 1: Hero-Karte (reduziert)
- Treffer 2–5: Carwow-Kompaktkarten
- Rest: „Weitere N geprüfte Alternativen“ (eingeklappt)

---

## Umsetzung

| Datei | Änderung |
|-------|----------|
| `discoveryDisplay.js` | Titel ohne Trim, Ein-Preis-Format |
| `DiscoveryHeroCard.jsx` | Ein-CTA-Layout Sprint 36 |
| `DiscoveryCuratedCard.jsx` | Treffer 2–5 |
| `DiscoveryResultsView.jsx` | Max 5 kuratiert, Overflow, Copy |
| `cleverQuoteConstants.js` | „geprüft“-Copy |
| `CleverQuoteBadge.jsx` | Breakdown Berater-Sprache |
| `cleverQuoteRecommendation.js` | `buildWishMatchBullets` |
| `CompareResultsHub.jsx` | Titel ohne Trim |
| `VehicleDetailPage.jsx` | Wunsch-Bullets Ebene 1 |
| `DiscoveryPriceSheet.jsx` | Leasing/Kauf-Umschalter (Sheet) |
| `HeroOffer.jsx` | Ebene 1 ohne Händler-Dock, Ausstattung verstehen |
| `SalesResultsPodium.jsx` | Wunsch-Bullets, kein Trim/Händler Ebene 1 |

---

## Erfolgskriterium (Mutter-Test)

1. Versteht sie in 3 Sekunden **welches Auto** und **warum**?
2. Sieht sie **einen Preis** ohne Scrollen?
3. Erst bei Klick: Ausstattung, Pakete, Händler?

---

## Status

- [x] Copy „geprüft“
- [x] Hero reduziert (1 CTA)
- [x] Top-5-Kuration
- [x] Wunsch-Bullets Ebene 1
- [x] Breakdown Ebene 2 Berater-Sprache
- [x] Preis-Sheet Leasing/Kauf (Hero Ergebnisse)
- [x] Detail-Hero Ebene 1 ohne Händler-Dock
- [x] Smart-Sales-Podium Wunsch-Sprache

**Sprint 36 abgeschlossen.**
