# Sprint 24 – Händler stärken statt Preiskampf

## Ziel

Nicht „Wer ist 3 € günstiger?“ – sondern **„Welcher Händler bietet das beste Gesamtpaket?“**

Preis bleibt sichtbar, ist aber nur **5 %** des Händler-Scores.

## Händler-Score

Gewichtung (`dealerScoreService.js`):

| Faktor | Gewicht |
|--------|---------|
| Entfernung | 20 % |
| Verfügbarkeit | 20 % |
| Lieferzeit | 15 % |
| Bewertung | 15 % |
| Vertragspartner | 10 % |
| Rabatt | 10 % |
| **Preis** | **5 %** |
| Service | 5 % |

Sortierung: **Score absteigend**, nicht billigste Rate zuerst.

## Angebotsseiten-Reihenfolge (verbindlich)

1. **Fahrzeug** – Konfiguration & Wünsche
2. **Empfohlener Händler** – `RecommendedDealerCard` (Vertrauen, Score, CTAs)
3. **Weitere Händler** – `DealerCompareCards` (Gesamtpaket-Karten)
4. **Weitere Fahrzeuge des Händlers** – `DealerInventoryCarousel`
5. **Ähnliche Fahrzeuge** – `SimilarVehiclesNearby` (Wettbewerber unten)
6. **Anfrage** – Detail + Aktionen

## Komponenten

- `src/components/dealer/RecommendedDealerCard.jsx`
- `src/components/dealer/DealerCompareCards.jsx`
- `src/components/dealer/DealerInventoryCarousel.jsx`
- `src/components/dealer/SimilarVehiclesNearby.jsx`
- `src/data/dealers/dealerProfiles.js` – Vertrauensprofile
- `src/services/dealer/dealerScoreService.js`

## USP

Leasingmarkt vergleicht Preise. Carwow vergleicht Angebote. **Clever-Neuwagen verbindet Fahrzeug, Händler, Wünsche und lokale Verfügbarkeit.**
