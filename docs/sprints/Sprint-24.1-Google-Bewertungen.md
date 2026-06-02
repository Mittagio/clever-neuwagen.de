# Sprint 24.1 – Echte Google-Bewertungen

## Ziel

Händler-Bewertungen und Rezensionen kommen live von der **Google Places API** (New) statt aus statischen Demo-Werten. Der Händler-Score und alle Rating-Badges nutzen dieselbe Datenquelle.

## Architektur

```
Browser → GET /api/v1/dealers/:slug/google-reviews
       → server/googlePlacesService.js (24h Cache)
       → Google Places Text Search + Place Details
       → Fallback: dealerProfiles.js (source: fallback)
```

### Dateien

| Bereich | Datei |
|---------|-------|
| Server | `server/googlePlacesService.js`, `server/googlePlacesRoutes.js` |
| Mapping | `src/data/dealers/dealerGooglePlaces.js` |
| Client | `src/services/dealer/googleReviewsService.js` |
| Hook | `src/hooks/useDealerGoogleReviews.js` |
| UI | `src/components/dealer/GoogleRatingBadge.jsx` |
| Score | `src/services/dealer/dealerScoreService.js` (Rating aus `offer.googleReviews`) |
| Seiten | `FahrzeugDetailPage`, `DealerPage`, `RecommendedDealerCard`, `DealerCompareCards` |

## Setup

1. In [Google Cloud Console](https://console.cloud.google.com/) **Places API (New)** aktivieren.
2. API-Key erstellen und einschränken (HTTP-Referrer / IP für Prod).
3. In `.env` setzen:

```env
GOOGLE_PLACES_API_KEY=AIza...
```

4. Dev-Server neu starten (`npm run dev`).

Ohne Key: Fallback auf `dealerProfiles` — UI zeigt Hinweis „API-Key setzen“.

## Place-IDs verfeinern

`dealerGooglePlaces.js` nutzt `textQuery`. Für präzisere Treffer optional `placeId` eintragen:

```js
'autohaus-trinkle': {
  textQuery: 'Autohaus Trinkle Kia Heilbronn',
  placeId: 'ChIJ...',
},
```

## Test

```bash
curl http://localhost:3001/api/v1/dealers/autohaus-trinkle/google-reviews
```

Erwartung mit Key: `"source": "google"`, `rating`, `reviewCount`, `reviews[]`.

UI: `/haendler/autohaus-trinkle` und `/fahrzeug/kia-sportage-spirit` — Google-Badge + Snippets.

## Cache

- Server: 24 Stunden pro Händler-Slug (In-Memory).
- Client: Hook dedupliziert parallele Requests pro Slug.
