# Sprint 22.1 – Magic Lens

## Ziel

Klassische Fahrzeugsuche **nicht entfernen**, aber **komplett aus der Hauptoberfläche** nehmen.

- **Hero / Ergebnisse** bleiben einfach (KI-Wunsch-Suche, Empfehlungen, Karten).
- **Alle Profi-Filter** leben in der **Magic Lens** – Bottom Sheet, mobile first.

## Komponente

`src/components/magic-lens/MagicLensDrawer.jsx`

### 3 Zustände

| Zustand | Verhalten |
|---------|-----------|
| `collapsed` | Peek-Leiste unten (72px), Badge mit aktiven Filtern |
| `half` | ~52 % Viewport – schneller Zugriff |
| `full` | ~92 % Viewport – alle Filter |

- Von unten hochziehbar (Pointer-Drag am Handle)
- Tap auf Peek-Leiste öffnet `half`
- Backdrop schließt auf `collapsed`

### Inhalt

1. **Kaufmodell** – Leasing, Finanzierung, Kauf
2. **Budget** – Leasingrate / Finanzierungsrate / Kaufpreis (je nach Modell)
3. **Fahrzeug** – Marke, Modell, Karosserie
4. **Ausstattung** – 360° Kamera, Totwinkel, AHK, Sitzheizung, Parksensoren vorne, Panoramadach
5. **Standort** – PLZ/Ort + Radius (25 / 50 / 100 km / Deutschlandweit)
6. **Verfügbarkeit** – Sofort, Bestellfahrzeug, Vorführwagen
7. **Leasing-Details** – Laufzeit, Kilometer, Sortierung

## Integration

- `FahrzeugePage.jsx` – `RefineSearchPanel` entfernt, Magic Lens fixed unten
- „Wünsche anpassen“ / Feature-Chip-Klick → Lens öffnet auf `half`
- Filter-URL-Params: `brand`, `availability`, `features`, … (bestehend + erweitert)

## Regel

**Autos zuerst, Filter danach.** Hero bleibt einfach – Komplexität nur in der Magic Lens.

## Dateien

- `src/components/magic-lens/MagicLensDrawer.jsx`
- `src/components/magic-lens/magicLens.css`
- `src/data/magicLensOptions.js`
