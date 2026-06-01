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

## Demo

Bis echte JPGs hinterlegt sind, liegen SVG-Platzhalter als `default.svg` vor.
`hero`/`card` in `manufacturerImages.js` verweisen bereits auf `hero.jpg`.

## Priorität (VehicleImage)

1. Händler-Inventar / Händler-Registry
2. **Diese Herstellerbilder**
3. Placeholder-Komponente
4. KI-Render (optional)
