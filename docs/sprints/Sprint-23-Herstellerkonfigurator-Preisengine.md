# Sprint 23 – Zentraler Herstellerkonfigurator + Dynamische Preisengine

## Ziel

Konfigurieren und **sofort** sehen: passende Ausstattung, benötigte Pakete, aktuelle Rate/Finanzierung/Kaufpreis, lokale Händlerangebote.

## Architektur: Zwei Ebenen

### Ebene 1 – Herstellerdatenbank (Platform Admin)
Zentral gepflegt in `src/data/manufacturer/`:
- `manufacturerRegistry.js` – Kia Sportage (bestehendes `sportage.js`), Kia EV3 (`kia/ev3.js`)
- Trims, Pakete, Equipment, Varianten, technische Daten
- Händler dürfen **keine** Stammdaten ändern

### Ebene 2 – Händlerdaten
Unverändert in `/backend` und `src/data/dealers/`:
- Rabatte, Leasingfaktoren, Finanzierung, Lieferzeiten, Bestände

## Services

| Datei | Funktion |
|-------|----------|
| `src/services/pricing/pricingEngine.js` | `priceConfiguration()`, `priceAllTrimsForWish()` |
| `src/services/pricing/dealerOfferPricing.js` | `getDealerOffersForConfiguration()` |
| `src/services/configurator/wishPackageResolver.js` | Paket-/Trim-Auflösung für Wünsche |
| `src/data/manufacturer/featureBridge.js` | Kunden-Feature ↔ Hersteller-Equipment |

## Kundenflow

1. Fahrzeug auf `/fahrzeuge` finden
2. Detailseite `/fahrzeug/:slug` – **Konfiguration & Wünsche** (Sportage, EV3)
3. Wünsche toggeln → System findet Trim + Pakete → Rate live
4. Ausstattungsvergleich aller Trims mit echten Preisen
5. Lokale Händlerangebote darunter

## Beispiel EV3 GT-Line + 360° Kamera

- System: **Technik Paket erforderlich**
- Rate: 329 € + 9 € = **338 €** (Demo)
- Händler: Trinkle 12 km, Müller 25 km

## USP vs. Carwow

Wunsch → passende Ausstattung automatisch → Sofort Preis → Sofort Händlerangebote → Anfragen

## Nächste Schritte

- EV4, weitere Marken in `manufacturerRegistry`
- Admin-UI für Platform-Stammdaten (bestehendes `/admin` erweitern)
- Marktplatz-Raten vollständig über `pricingEngine` statt Hardcoding
