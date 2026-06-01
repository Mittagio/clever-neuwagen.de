# clever-neuwagen.de

Clever-Neuwagen – React/Vite Frontend + Express API (Demo/Pilot).

## Entwicklung

```bash
npm install
npm run dev
```

- App: http://localhost:5175  
- API: http://localhost:3001  

## Build

```bash
npm run build
npm run start:prod
```

## Live (IONOS VPS Linux)

Schritt-für-Schritt: **[DEPLOY.md](./DEPLOY.md)**

Kurz: VPS Linux (Ubuntu) → `deploy/ionos-vps-setup.sh` → `npm ci && npm run build` → PM2 → nginx → DNS → Certbot.

## Herstellerbilder

Zentrale Registry: `src/data/media/manufacturerImages.js`  
Assets: `public/images/manufacturers/kia/`
