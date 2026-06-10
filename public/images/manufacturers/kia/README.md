# Kia Herstellerbilder (ManufacturerMediaSystem)

Zentrale Ablage für OEM-Fahrzeugbilder. Registrierung in `src/data/media/manufacturerImages.js`.

## Struktur

```
kia/
  sportage/default.jpg   ← eine Datei, überall in der App
  ev3/default.jpg
  ev4/default.jpg
  niro/default.jpg
  sorento/default.jpg
  ceed/default.jpg
```

## Hero (Landing)

Für die drei schwebenden Hero-Karten: `hero.jpg` pro Modell (Pressebild, Querformat).

```
sportage/hero.jpg
ev3/hero.jpg
ev4/hero.jpg
```

Bis `hero.jpg` fehlt, lädt die App Pressebilder aus `src/data/landingHeroVehicles.js` (Fallback).

## OEM-Fotos (alle Farben)

Neue Pressefotos von Kia ablegen:

```
public/images/manufacturers/kia/_incoming/ev2/hero.jpg
public/images/manufacturers/kia/_incoming/ev2/colors/snow-white-pearl.jpg
```

Dann:

```bash
npm run import:kia-photos
```

Details: `_incoming/README.md`

## Demo (PDF-Fallback)

Alle JPGs werden aus den offiziellen Kia-Preislisten extrahiert (Titelseite, wie Sorento):

```bash
npm run extract:kia-images
```

Quelle: `scripts/extract-kia-pdf-images.mjs` · Registry: `src/data/kia/kiaModelImages.json`

## Priorität (VehicleImage)

1. Händler-Inventar / Händler-Registry
2. **Diese Herstellerbilder**
3. Placeholder-Komponente
4. KI-Render (optional)
