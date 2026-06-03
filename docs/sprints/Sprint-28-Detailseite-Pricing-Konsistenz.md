# Sprint 28 – Detailseite: Wunsch-Konfigurator, Pricing-Resolver, Payment-Konsistenz

## Grundsatz

**Ein Zustand. Eine Preislogik. Eine Anzeige.**

`paymentMode` steuert Hero, Sticky, Mobile-Bar, Wunsch-Panel, Paketempfehlung, Better-Trim und Anfrage.

## Architektur

| Schicht | Datei |
|---------|--------|
| State | `src/hooks/useVehicleDetailController.js` |
| Preis | `src/services/pricing/pricingResolver.js` |
| Ausstattung | `src/services/configuration/featureResolver.js` |
| Page | `src/pages/VehicleDetailPage.jsx` (`FahrzeugDetailPage` re-export) |

## detailSelection

```js
{
  paymentMode: 'leasing' | 'financing' | 'cash',
  termMonths, mileagePerYear, downPayment, financeDown, financeBalloon,
  brand, model, trim, selectedColor,
  selectedFeatures, selectedPackages, selectedAccessories,
  selectedDealerOfferId, recommendationResult
}
```

## Komponenten

- `vehicle/HeroOffer`, `StickyOfferBox`, `MobileStickyBar`
- `pricing/PriceToolCard`, `PriceDrawer`
- `configurator/WishBuilderCard`, `WishFeatureChip`, `WishResultPanel`, `PackageRecommendationCard`, `BetterTrimCard`
- `dealer/DealerCompareCard`, `DealerTrustCard`
- `inquiry/InquirySummaryModal`

## Regeln

- Komponenten erhalten nur `displayPrice.label` — keine direkte `offer.monthlyRate`
- `cash`: nirgends `/Monat` als Hauptpreis
- Feature-Klick → `toggleFeature` → `buildRecommendation` → Preis neu

## Tests

```bash
npm run test:pricing-resolver
npm run test:vehicle-detail-pricing
npm run test:wish-magic
```
