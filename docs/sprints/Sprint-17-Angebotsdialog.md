# Sprint 17 – Digitaler Angebotsdialog Kunde ↔ Verkäufer

## Ziel

Clever-Neuwagen bildet den kompletten Angebotsdialog digital ab.

Der Kunde kann Sonderwünsche angeben, Rückfragen stellen, angepasste Angebote erhalten, digital annehmen, Unterlagen einreichen, Selbstauskunft ausfüllen sowie Ausweis und Gehaltsnachweis hochladen.

Der Verkäufer sieht und bearbeitet alles im Verkaufschancen-System.

---

## Kundenflow

### 1. Angebot ansehen

Route: `/angebot/:offerId`

Kunde sieht: Fahrzeug, Rate, Laufzeit, Kilometer, Anzahlung, Lieferzeit, Händler, Ansprechpartner.

Buttons: Angebot merken · Anfrage starten · Frage stellen · Sonderwunsch angeben

### 2. Anfrage starten

Felder: Name, E-Mail, Telefon optional, Nachricht optional.

Sonderwünsche: Wunschfarbe, Anhängerkupplung, Gummifußmatten, Winterräder, Glasdach, andere Laufzeit/Kilometer/Anzahlung, sonstiger Wunsch.

→ Intern entsteht eine **Verkaufschance** (kein neuer Duplikat-Eintrag pro Aktion).

### 3. Verkäufer – Verkaufschance

Route: `/backend/verkaufschancen/:id`

Sichtbar: Kundendaten, Angebot, Sonderwünsche, Kommunikationsverlauf.

### 4. Gegenangebot (Phase 2)

Verkäufer passt Rate, Laufzeit, Zubehör an → „Digitales Angebot senden“.

### 5. Kunde – digitales Angebot (Phase 2)

Route: `/mein-bereich/angebote/:offerId` oder `/angebot/:offerId?token=…`

### 6. Angebot annehmen (Phase 2)

Kunde sieht Banner **„Aktualisiertes Angebot“** und kann **Annehmen**, **Rückfrage stellen** oder **Ablehnen** (via Magic Link, Kundenkonto oder Dialog-Session).

### 7. Unterlagen anfordern (Phase 3 – Verkäufer)

Verkaufschance → Panel **„Unterlagen anfordern“** → Slots wählen → E-Mail mit Checklisten-Link (48h-Frist).

### 8. Kunde – Upload-Checkliste (Phase 3)

Route: `/mein-bereich/unterlagen/:requestId?token=…`

Checkliste mit Fortschritt, Upload pro Slot (Ausweis, Gehaltsnachweise, Führerschein).

### 9. Selbstauskunft (Phase 3)

Route: `/selbstauskunft?offer=:code&request=:requestId`

Nach Absenden: Slot erledigt, Dialog-Event in Verkaufschance, Dokument im Dossier.

### 10. 48h-Dokumenten-Tresor

Uploads mit `expiresAt` (48h), Countdown in Checkliste und Verkaufschance-Dossier.

### 11. Angebotsseite – Unterlagen-Hinweis

Bei offener Anforderung: Banner **„Unterlagen benötigt“** auf `/angebot/:code`.

### 12. Kommunikationsverlauf

Alle Aktionen im Dialog: Anfrage, Sonderwunsch, Gegenangebot, Annahme, Unterlagen, Uploads.

---

## Begriffe

| Kunde | Händler |
|-------|---------|
| Angebot | Verkaufschance |
| Anfrage | Angebot / Dialog |
| Unterlagen | Unterlagen |
| Nachricht | Dialog |

**Niemals „Lead“ in der UI.**

---

## Trennung

- Kunde landet **nie** im Händlerbackend.
- Verkäufer sieht **nicht** den Kundenflow.
- Beide Welten verbunden über Verkaufschance + Angebots-Code.

---

## Implementierungsstand

| Phase | Inhalt | Status |
|-------|--------|--------|
| **1** | Dialog-Kern, Sonderwünsche, Upsert Verkaufschance, Timeline | ✅ Fertig |
| **2** | Gegenangebot, Annahme, Magic Link | ✅ Fertig |
| **3** | Unterlagen-Checkliste, 48h-Upload, Selbstauskunft verknüpft | ✅ Fertig |

---

## Architektur (Kern-Dateien)

| Bereich | Dateien |
|---------|---------|
| Spec | `docs/sprints/Sprint-17-Angebotsdialog.md` |
| Dialog-Typen & Events | `src/data/offerDialogTypes.js`, `src/data/documentRequestTypes.js` |
| Dialog-Logik | `src/logic/offerDialogService.js`, `src/logic/offerAccessToken.js`, `src/logic/documentRequestService.js` |
| Kunde – Angebot | `src/components/sprint7/OfferMiniSite.jsx`, `OfferInquiryModal`, `OfferDialogThread`, `CounterOfferBanner` |
| Kunde – Unterlagen | `src/pages/UnterlagenChecklistPage.jsx` |
| Kunde – Selbstauskunft | `src/pages/sprint5/SelbstauskunftPage.jsx` (`?offer=` / `?request=`) |
| Händler – Dossier | `SalesChanceDossier`, `CounterOfferPanel`, `DocumentRequestPanel` |
| Context | `LeadsContext.upsertLeadFromOfferAction`, `CommunicationContext.sendCounterOffer`, `requestDocuments` |

---

## Testplan (manuell)

1. `/angebot/CN-2026-00001` → Anfrage + Sonderwünsche → Dialog-Timeline sichtbar
2. `/backend/verkaufschancen` → Verkaufschance → Gegenangebot senden → Magic Link → Annehmen/Ablehnen
3. Verkaufschance → Unterlagen anfordern → Checkliste → Upload + Selbstauskunft
4. Kommunikationscenter Tab **Dokumente** + Dossier-Block prüfen
5. `npm run deploy:check` grün
