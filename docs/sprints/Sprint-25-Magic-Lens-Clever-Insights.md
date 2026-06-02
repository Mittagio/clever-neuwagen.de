# Sprint 25 – Magic Lens nur dort, wo sie hilft

## Produktentscheidung

Clever-Neuwagen ist eine **intelligente Fahrzeugsuchmaschine**, keine Chat-App.

| Plattform | Verhalten |
|-----------|-----------|
| **Desktop** | Keine schwebende Magic Lens. Stattdessen **Clever Insights** inline zwischen Suchchips und Ergebnissen. |
| **Mobile** | Magic Lens bleibt als dezenter Helfer unten — einzeiliger Tipp + Filter-Button, kein Chatbot-Branding. |

## Verboten

- ChatGPT-Modus, Begrüßungen, Konversations-UI
- „Frage zu den Ergebnissen?“-Link auf `/fahrzeuge`
- Schwebende Assistentenleiste auf Desktop

## Clever Insights (Desktop)

Ruhe, Trade-Republic-Niveau: konkrete Vorschläge mit Aktion.

Beispiele:

- Radius erweitern → X weitere Fahrzeuge
- Budget erhöhen → X weitere Treffer
- Hybrid-Alternative bei Elektro-Suche
- Ausstattung über Paket (z. B. Wärmepumpe am EV3)

**Dateien:**

- `src/logic/cleverInsightsService.js` — Vorschlags-Engine mit Trefferzählung
- `src/components/search/CleverInsightsPanel.jsx` — Inline-Karten
- `src/components/search/desktopSearchRefine.css` — Desktop-Filter (details)

## Magic Lens (Mobile only)

- Nur unter 768px sichtbar (`magic-lens--sheet`)
- Collapsed: **Clever Insight**-Tipp (antippen → Suche aktualisieren) + kompakter „Filter“-Button
- Kein „Magic Lens“-Label, kein „Nach oben ziehen“-Chatbot-Feeling

**Dateien:**

- `src/components/magic-lens/MagicLensDrawer.jsx`
- `src/components/magic-lens/magicLens.css`

## Desktop-Filter

`DesktopSearchRefine` — eingeklapptes `<details>` mit Laufzeit, Kilometer, Radius, Sortierung.  
„Wünsche anpassen“ öffnet auf Desktop dieses Panel, auf Mobile die Magic Lens.

## Seite

`src/pages/FahrzeugePage.jsx` — Clever Insights + Desktop Refine + Mobile Lens

## Design-Prinzip

> Die Suche versteht mich. — nicht: Ich chatte mit einer KI.

Fahrzeuge bleiben der Star.
