# Sprint 35 – Mobile-First Audit (Gesamtplattform)

## Ziel

Nicht nur die Fahrzeugdetailseite optimieren – **die gesamte Plattform** muss mobile-first werden.

**Merksatz (Erfolgskriterium):**

> Kann meine Mutter auf dem Handy verstehen, warum ihr dieses Auto empfohlen wird?

Wenn das klappt, ist die wichtigste Hürde genommen.

---

## Regeln (verbindlich für alle MF-Sprints)

| Regel | Bedeutung |
|-------|-----------|
| Mobile zuerst | Desktop passt sich Mobile an, nicht umgekehrt |
| Eine Hauptaktion | Pro Bildschirm / Bereich maximal eine primäre Aufgabe |
| Weniger Scrollen | Max. 2–3 Scrollhöhen bis zur Kernaktion (Anfrage / Weiter) |
| Bottom Sheets | Preis, Wünsche, Vergleich, Filter, Anfrage – nicht lange Kartenstapel |
| Mehr Chips | Weniger Fließtext, mehr tippbare Chips |
| Immer sichtbar | CleverQuote, Preis und CTA im sichtbaren Bereich (Hub/Dock) |
| Kein Desktop-Shrink | Keine Desktop-Layouts „responsive machen“ und fertig |

**Mobile-Hierarchie (Referenz Detail & Ergebnisse):**

1. Fahrzeugbild  
2. Fahrzeugname  
3. CleverQuote  
4. Preis  
5. Anfrage starten  
6. Drei Aktionen: Preis ändern · Wünsche ändern · Angebote vergleichen  
7. Alles Weitere erst auf Klick (Sheet / „Mehr“)

---

## Audit-Stand

**Datum:** 2026-06-03  
**Methode:** Code-Review (Pages, CSS-Breakpoints, Sheet/Sticky-Muster) – **keine Umsetzung in diesem Sprint**  
**Fokus-Routen:** Kunde + Verkäufer-MVP

---

## Kurzfazit

Die Plattform ist **technisch responsive**, aber **konzeptionell desktop-zentriert**: Zwei-Spalten-Layouts, Sticky-Sidebars, Karten-Stapel und Center-Modals dominieren. Mobile wird oft durch Wegdrücken (`display: none`, kleinere Grids) gelöst – nicht durch Mobile-first Hub + Bottom Sheets.

**Begonnen (lokal, Stand Audit):** Fahrzeugdetailseite – `HeroOffer` Mobile-Hub, `MobileBottomSheet`, Wunsch-/Vergleich-Sheets (noch nicht committed).

---

## Bereichs-Audit

### 1. Startseite

**Route:** `/` · `LandingPage.jsx` · `LandingHero.jsx`

| ✅ Mobile-nah | ❌ Desktop-zentriert / Problem |
|--------------|-------------------------------|
| Zentrale Suche + Beispiel-Chips | 5-zeiliges Textarea → viel Scroll vor CTA |
| Chips als schneller Einstieg | Lange Subline, 8 Chips ohne Einklapp/Scroll |
| | Breakpoints ab 960px in `LandingPage.css` – Design für große Hero-Fläche |

**Empfehlung MF:** Ein Screen = „Was suchst du?“ · 1–2 Zeilen Input · horizontal scrollbare Chips · Sprache als Chip/Aktion.

---

### 2. Suchergebnisse

**Route:** `/fahrzeuge` · `FahrzeugePage.jsx` · `DiscoveryResultsView.jsx`

| ✅ Mobile-nah | ❌ Desktop-zentriert / Problem |
|--------------|-------------------------------|
| `MagicLensDrawer` für Filter | Ab 960px: `grid 1fr + 300px` + **sticky** Sidebar (`discovery-results.css`) |
| Chip-Zusammenfassung oben | `DiscoveryHeroCard`: ab 640px Zwei-Spalten; **Händler vor Preis** |
| | Lange Seite: Hero → Compare → Rest-Grid → Alternativen → Beliebt → Händler-Trust |
| | `DesktopSearchRefine` + `CleverInsightsPanel` nur Desktop (`refineSlot`) |
| | CleverQuote auf Hero ohne kompaktes „Warum?“ (max. 3 Bullets) |

**Referenz:** Sprint 15/16 (Ergebnisseite vereinfachen) – Ziele noch nicht vollständig mobile-first umgesetzt.

**Empfehlung MF:** Mobile Hub wie Detail: ein Treffer above-the-fold, Rest-Liste + Filter in Sheets.

---

### 3. Fahrzeugdetailseite

**Route:** `/fahrzeuge/:slug` · `VehicleDetailPage.jsx`

| ✅ Mobile-nah (begonnen) | ❌ Noch offen |
|--------------------------|-------------|
| Hero-Dock: CQ → Preis → CTA → 3 Aktionen | Änderungen noch **uncommitted** |
| `MobileBottomSheet` Wünsche / Vergleich | Preis-Sheet nur nativ ≤767px (`vd-calc__sheet`) |
| Desktop-Tools per `vd-desktop-only` ausgeblendet | `InquirySummaryModal`: Center-Modal + lange Textliste |
| | Regel 6: historisch 3 Preise gleichzeitig (Sales-Kontext teils behoben) |

**Empfehlung MF-1:** Hub fertigstellen, committen, Anfrage als Bottom Sheet – **Blueprint für andere Seiten**.

---

### 4. Vergleichsseite

**Route:** `/vergleich` · `ComparePage.jsx`

| ✅ | ❌ |
|----|-----|
| CleverQuoteCompareCards | Kein Mobile-Hub; bei 3+ Fahrzeugen langer Kartenstapel |
| WishSummaryBar | Kein Swipe / 1-vs-1 / Sheet für weiteres Fahrzeug |
| | CleverQuote + Preis + CTA nicht garantiert above-the-fold |

**Empfehlung MF:** Mobile Top-2 + Sheet „weiteres Fahrzeug“; Desktop Karten/Tabelle.

---

### 5. Verkäufermodus

**Routen:** `/sales/smart` · `/gespraech` · `/sales`

| ✅ | ❌ |
|----|-----|
| Sprint 34: Top-3-Podium, „Warum?“ | Smart Sales: **Sidebar auch auf Mobile** (Kommunikation parallel) |
| Chip-Picker Bedarfsanalyse | Klassisch `/sales`: Formular + Kartenliste (Desktop-Formular) |
| SalesVehicleDetail vereinfacht (Sprint 34 D) | Kein einheitliches Bottom-Sheet-Muster wie Kundenseite |
| | Stats-Bar + KiaPartnerBar → viel Mobile-Höhe |

**Empfehlung MF:** Sidebar auf Mobile erst nach Podium-Auswahl (Sheet / eigener Step).

---

### 6. Händlerdashboard

**Routen:** `/backend` · `/haendler/:slug`

| ✅ | ❌ |
|----|-----|
| Horizontal scrollende Sub-Nav | Multi-Column-Grids (Discount, Leasing, Finance) |
| | Admin-Tool-Optik, nicht durchgängig Daumen-first (60px) |
| | DealerPage: langer Marketing-Scroll |

**Priorität MVP:** **Niedrig** – Mutter-Test betrifft Kunden-Handy, nicht Backend.

---

### 7. Kundenanfrage-Flow

**Komponenten:** `InquirySummaryModal.jsx` · `CustomerInquiryModal.jsx`

| ✅ | ❌ |
|----|-----|
| Strukturierte Zusammenfassung aus Selection | **Center-Modal** (480px), nicht Bottom Sheet |
| | Lange `lines[]`-Liste (Wünsche, Serienausstattung, Paket, Händler) |
| | Tastatur + Modal = schlechte Mobile-UX |

**Empfehlung MF:** Schritt 1: Preis + Kurz-Warum bestätigen · Schritt 2: Kontakt (Sheet) · max. 3 Bullets.

---

## Querschnitt: Desktop-Muster in der Codebase

| Muster | Wo | Mobile-Problem |
|--------|-----|----------------|
| `grid 1fr + 300px` + `sticky` | Discovery, Vehicle Detail | Sidebar-Logik auf Handy wirkungslos / doppelte UX mit Fixed-Bar |
| „Desktop“ im Komponentennamen | `DesktopSearchRefine` | Zwei parallele Welten statt ein Sheet |
| Karten-Stapel | `vd-tools-flow`, Advisor Steps, Dealer Cards | Viel Scroll bis Aktion |
| Center-Modals | Anfrage, Save Offer, teils CQ | Nicht iPhone-nativ |
| `min-width: 768/960/1024` überall | CSS-Architektur | Design startet Desktop; Mobile = Kompakt-Variante |
| Händler vor Fahrzeug/CQ | Discovery Hero (alt) | Regel: Fahrzeug → CQ → Preis → Händler |

**Bereits mobile-nah:** `MagicLensDrawer`, `VehiclePriceCalculator`-Sheet, Sprint-34-Podium, `MobileBottomSheet` (neu), Chip-Editoren (teilweise).

---

## Prioritäten

### 🔴 Hoch (MVP / Mutter-Test)

| # | Thema | Dateien / Routen |
|---|--------|------------------|
| H1 | Suchergebnisse Mobile Hub | `DiscoveryResultsView.jsx`, `DiscoveryHeroCard.jsx`, `discovery-results.css` |
| H2 | Fahrzeugdetail Sprint abschließen + committen | `HeroOffer.jsx`, `VehicleDetailPage.jsx`, `MobileBottomSheet.jsx` |
| H3 | Anfrage Bottom Sheet + Kurzform | `CustomerInquiryModal.jsx`, `InquirySummaryModal.jsx` |
| H4 | Discovery Hero: Hierarchie (CQ/Preis vor Händler) | `DiscoveryHeroCard.jsx` |
| H5 | Smart Sales: Sidebar auf Mobile aus | `SmartSalesPage.jsx`, `smartSales.css` |

### 🟡 Mittel

| # | Thema |
|---|--------|
| M1 | Vergleichsseite Mobile (Top-2 + Sheet) |
| M2 | Startseite Input/Chips straffen |
| M3 | Einheitliche `MobileBottomSheet`-API (Filter, Preis, Wünsche, Vergleich, Anfrage) |
| M4 | CleverQuote Breakdown nur on-demand (nie inline-Wand auf Mobile) |
| M5 | Klassisches `/sales` an Hub angleichen oder als Legacy markieren |

### 🟢 Niedrig

| # | Thema |
|---|--------|
| N1 | Backend-Grids / Touch-Targets |
| N2 | DealerPage Marketing-Mobile |
| N3 | Sticky-Sidebars nur ≥1024px (Audit-Guard in CSS) |
| N4 | Admin, Intelligence, Trends |

---

## Umsetzungsplan (gezielt – nicht blind)

| Sprint | Fokus | Erfolgskriterium |
|--------|--------|------------------|
| **MF-1** | Detail fertig + Anfrage-Sheet | 30-Sekunden-Test Detail auf iPhone ✓ |
| **MF-2** | Suchergebnisse Mobile Hub | Ein Treffer ohne Scroll bis CTA |
| **MF-3** | Vergleich + Discovery Hero | Top-2 vergleichbar ohne Scroll-Marathon |
| **MF-4** | Verkäufermodus Side-Panel | Beratung nur Hauptspalte auf Handy |
| **MF-5** | Backend/Dealer (optional) | Konditionen am Tablet bedienbar |

---

## Was in Sprint 35 NICHT passiert

- Kein flächendeckender Komponenten-Umbau  
- Keine neuen Features (KI, Händler-Logik, CleverQuote-Berechnung)  
- Kein Desktop-Redesign – nur Mobile-first Ergänzung, Desktop erbt Layout

---

## Abhängigkeiten

- Baut auf **Sprint 34** (Vertrauen, Top-3, Podium) auf  
- Referenz-Implementierung Detail: `MobileBottomSheet.jsx`, `HeroOffer--mobile-first`  
- Verwandte ältere Sprints: **15**, **16** (Ergebnisseite), **28** (Pricing Konsistenz)

---

## Nächster Schritt (Entscheidung Product)

- [x] **MF-1** – Detail: Anfrage-Sheet + Preis-Sheet (≤1023px)
- [x] **MF-2** – Suchergebnisse Mobile Hub
- [x] **MF-3** – Vergleich Top-2 + Sheet
- [x] **MF-4** – Verkäufermodus: Sidebar → Sheet
- [x] **MF-5** – Backend/Dealer Tablet-Touch
- [x] Audit committen (dieses Dokument)

---

## Test-Checkliste (30-Sekunden-Mutter-Test)

Pro Screen auf iPhone/Android (WLAN-Dev oder Production):

1. Versteht sie **warum** das Fahrzeug empfohlen wird? (CleverQuote + max. 3 „Warum?“-Punkte)  
2. Sieht sie den **Preis** ohne Scrollen?  
3. Kann sie **Wünsche ändern** ohne lange Seite? (Sheet/Chips)  
4. Kann sie **Anfrage starten** in ≤30 Sekunden?  
5. Wird sie **nicht** von Händler/Technik-Text abgelenkt?

**Routes Pflicht:** `/` → `/fahrzeuge?…` → Detail → Anfrage · optional `/sales/smart`
