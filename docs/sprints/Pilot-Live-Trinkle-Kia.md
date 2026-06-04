# Pilot LIVE – Autohaus Trinkle · Kia only · echte Leads

## Aktivierung

| Umgebung | So aktivieren |
|----------|----------------|
| **Lokal** | `.env.local` mit `VITE_PILOT_LIVE=true` (liegt bereits im Projekt, gitignored) |
| **Dev-Script** | `npm run dev:pilot` |
| **Production Build** | `VITE_PILOT_LIVE=true npm run build` auf dem Server |

Variablen (`.env.example`):

- `VITE_PILOT_LIVE=true` – Pilot-Modus
- `VITE_PILOT_DEALER_ID=autohaus-trinkle` – nur Fahrzeuge dieses Händlers
- `VITE_PILOT_KIA_ONLY=true` – nur Kia im Marktplatz

## Was sich ändert

1. **Startseite `/`** → Weiterleitung zu `/haendler/autohaus-trinkle`
2. **Marktplatz** (`/fahrzeuge`, Detail, Vergleich, Berater) → nur Kia @ Trinkle
3. **Leads** → keine Demo-/Pilot-Leads; nur echte Anfragen aus dem Flow
4. **Backend** → grünes „Pilot LIVE“-Banner mit Link zur Kunden-Landing

Leads liegen weiter in `localStorage` (`clever-neuwagen-leads`) – gleicher Browser = Lead sichtbar unter `/backend/verkaufschancen`.

## Test-Checkliste (mit echtem Kunden)

1. `npm run dev:pilot` starten (oder normal `npm run dev` mit `.env.local`)
2. **Backend prüfen:** `/backend` → Banner sichtbar, **0 Demo-Leads**
3. **Kunden-Landing:** `/haendler/autohaus-trinkle` oder `/` (Redirect)
4. Kia-Fahrzeug wählen → Detailseite → **Anfrage senden** (Name, E-Mail, ggf. Telefon)
5. **Lead prüfen:** `/backend/verkaufschancen` oder `/communication` → neuer Lead mit Brief, CQ %, Budget
6. Optional: WhatsApp-Text aus Lead-Detail testen

## Hinweise

- Alte Demo-Leads in localStorage werden im Pilot-Modus **nicht geladen** (IDs werden gefiltert).
- Für einen komplett leeren Start: DevTools → Application → Local Storage → `clever-neuwagen-leads` löschen.
- Subdomain `autohaus-trinkle.clever-neuwagen.de` zeigt weiter nur die Händler-Landing (unabhängig vom Flag).

## Code

- `src/config/pilotLive.js` – Flags
- `src/data/marketplacePool.js` – gefilterter Fahrzeug-Pool
- `src/context/LeadsContext.jsx` – echte Leads ohne Demo-Seed
