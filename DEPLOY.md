# Live-Deployment: IONOS VPS Linux

Anleitung für **clever-neuwagen.de** mit Ubuntu-VPS, nginx, Node.js 22, PM2 und Let's Encrypt.

**Architektur:** Browser → nginx (443) → Node/Express `127.0.0.1:3001` → React-Build (`dist/`) + API `/api`

---

## Phase 0 – Checkliste vor dem Start

| Punkt | Status |
|-------|--------|
| Domain **clever-neuwagen.de** bei IONOS (oder DNS dort verwaltbar) | ☐ |
| GitHub-Repo: `https://github.com/Mittagio/clever-neuwagen.de` | ☐ |
| SSH-Client (Windows: PowerShell, PuTTY oder Windows Terminal) | ☐ |

**Empfohlener VPS:** IONOS → **Server & Cloud** → **VPS Linux** → Ubuntu **24.04 LTS** (mind. 2 vCPU / 4 GB RAM für den Start).

---

## Phase 1 – VPS bei IONOS bestellen

1. [IONOS Kundenbereich](https://www.ionos.de/) → **Server & Cloud** → **VPS Linux**.
2. Tarif wählen (z. B. **VPS Linux S** reicht für Pilot/Start).
3. **Ubuntu 24.04** als Betriebssystem.
4. Region: **Deutschland** (niedrigere Latenz).
5. Optional: SSH-Schlüssel hinterlegen (empfohlen statt nur Passwort).
6. VPS erstellen und notieren:
   - **Öffentliche IPv4** (z. B. `85.xxx.xxx.xxx`)
   - **Root-Passwort** (falls kein SSH-Key)

### Firewall in der IONOS-Konsole

In den VPS-Einstellungen **Firewall** öffnen und erlauben:

| Port | Protokoll | Zweck |
|------|-----------|--------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (Certbot + Redirect) |
| 443 | TCP | HTTPS |

---

## Phase 2 – Erste Verbindung per SSH

**Windows (PowerShell):**

```powershell
ssh root@IHRE-VPS-IP
```

Beim ersten Mal Fingerprint mit `yes` bestätigen, dann Root-Passwort eingeben.

**Optional – eigenen Deploy-Benutzer (empfohlen):**

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Ab dann: `ssh deploy@IHRE-VPS-IP` (mit `sudo` für Admin-Befehle).

---

## Phase 3 – Server-Basis installieren

Auf dem VPS als **root** (oder `deploy` mit `sudo`):

```bash
# Projekt zuerst klonen (öffentliches Repo)
export APP_DIR=/var/www/clever-neuwagen
mkdir -p /var/www
cd /var/www
git clone https://github.com/Mittagio/clever-neuwagen.de.git clever-neuwagen
cd clever-neuwagen

# Erstinstallation: Node 22, nginx, PM2
sudo bash deploy/ionos-vps-setup.sh
```

**Privates GitHub-Repo:** Deploy-Key oder Personal Access Token nutzen – siehe [GitHub Deploy Keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

---

## Phase 4 – App bauen und starten

```bash
cd /var/www/clever-neuwagen

# Abhängigkeiten & Production-Build
npm ci
npm run build

# Umgebung
cp .env.example .env
nano .env   # PUBLIC_URL prüfen: https://www.clever-neuwagen.de

# Prozess-Manager
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # ausgegebenen Befehl einmal kopieren und ausführen
```

**Health-Check (nur auf dem Server):**

```bash
curl -s http://127.0.0.1:3001/health
# Erwartung: {"ok":true,"service":"clever-neuwagen",...}
```

---

## Phase 5 – nginx konfigurieren

```bash
cd /var/www/clever-neuwagen
sudo bash deploy/configure-nginx.sh
```

Test im Browser (noch HTTP): `http://IHRE-VPS-IP` – sollte die App zeigen, wenn DNS schon zeigt, sonst Host-Header beachten.

---

## Phase 6 – DNS bei IONOS

**Domains & SSL** → **clever-neuwagen.de** → **DNS**:

| Typ | Host | Wert | TTL |
|-----|------|------|-----|
| **A** | `@` | `IHRE-VPS-IP` | 300 |
| **A** | `www` | `IHRE-VPS-IP` | 300 |
| **A** | `autohaus-trinkle` | `IHRE-VPS-IP` | 300 |
| **A** | `autohaus-mueller` | `IHRE-VPS-IP` | 300 |

Alternativ für alle Händler: **A** `*` → VPS-IP (Wildcard-DNS bei IONOS, falls verfügbar).

Propagation kann **5–60 Minuten** dauern. Prüfen:

```bash
# lokal oder auf dem VPS
ping www.clever-neuwagen.de
```

---

## Phase 7 – SSL (HTTPS) mit Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d clever-neuwagen.de -d www.clever-neuwagen.de
```

- E-Mail angeben, AGB akzeptieren.
- **Redirect HTTP → HTTPS:** Option **2** (empfohlen).

Erneuerung testen:

```bash
sudo certbot renew --dry-run
```

**Live-URL:** https://www.clever-neuwagen.de

### Händler-Subdomains

```bash
sudo cp /var/www/clever-neuwagen/deploy/clever-neuwagen-dealer-subdomains.nginx /etc/nginx/sites-available/clever-neuwagen-dealers
sudo ln -sf /etc/nginx/sites-available/clever-neuwagen-dealers /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Wildcard-Zertifikat (DNS-Challenge bei IONOS):

```bash
sudo certbot certonly --manual --preferred-challenges dns -d '*.clever-neuwagen.de'
```

**Live-Beispiele:**

- https://autohaus-trinkle.clever-neuwagen.de  
- https://autohaus-mueller.clever-neuwagen.de  

**Lokal testen:** `http://localhost:5173/haendler/autohaus-trinkle` oder `?dealer=autohaus-mueller`

---

## Phase 8 – Updates nach Code-Änderungen

Auf dem VPS:

```bash
cd /var/www/clever-neuwagen
bash deploy/update-app.sh
```

Oder manuell:

```bash
git pull
npm ci
npm run build
pm2 restart clever-neuwagen --update-env
```

---

## Wichtige Befehle

| Aufgabe | Befehl |
|---------|--------|
| App-Logs | `pm2 logs clever-neuwagen` |
| Status | `pm2 status` |
| nginx testen | `sudo nginx -t` |
| nginx neu laden | `sudo systemctl reload nginx` |
| Port 3001 belegt? | `sudo lsof -i :3001` |

---

## Fehlerbehebung

### „502 Bad Gateway“

- App läuft nicht: `pm2 status` → `pm2 restart clever-neuwagen`
- Build fehlt: `npm run build` und `dist/` prüfen
- Health: `curl http://127.0.0.1:3001/health`

### Domain zeigt nicht auf den Server

- DNS A-Records prüfen (Phase 6)
- Alte DNS-Einträge / CDN bei IONOS deaktivieren

### Certbot schlägt fehl

- Port **80** muss von außen erreichbar sein (Firewall IONOS + `ufw`)
- DNS muss bereits auf die VPS-IP zeigen

### `npm: command not found`

- Setup-Skript erneut: `sudo bash deploy/ionos-vps-setup.sh`
- Shell neu verbinden: `source ~/.bashrc`

---

## Dateien im Repo

| Datei | Zweck |
|-------|--------|
| `deploy/ionos-vps-setup.sh` | Node, nginx, PM2 installieren |
| `deploy/configure-nginx.sh` | nginx-Site aktivieren |
| `deploy/clever-neuwagen.de.nginx` | Reverse-Proxy-Vorlage |
| `deploy/update-app.sh` | Git pull + Build + PM2 restart |
| `ecosystem.config.cjs` | PM2-Produktionskonfiguration |
| `.env.example` | Produktions-Umgebungsvariablen |

---

## Nächste Schritte (optional)

- [ ] GitHub Action für automatisches Deploy (SSH-Secret)
- [ ] Offizielle Kia-`hero.jpg` in `public/images/manufacturers/kia/`
- [ ] E-Mail: `VITE_EMAIL_PROVIDER` + Resend-Key in `.env`
- [ ] Monitoring (z. B. UptimeRobot auf `/health`)
