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

## Demo

Bis echte JPGs hinterlegt sind, liegen SVG-Platzhalter als `default.svg` vor.
Nach dem Austausch: Pfad in `manufacturerImages.js` auf `.jpg` ändern.

## Priorität (VehicleImage)

1. Händler-Inventar / Händler-Registry
2. **Diese Herstellerbilder**
3. Placeholder-Komponente
4. KI-Render (optional)
