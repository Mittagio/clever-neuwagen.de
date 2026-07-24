# Clever Responsive Product Law

**Stand:** 2026-07-24  
**Commit-Ziel:** `refactor: establish project-wide mobile-first responsive workspace system`

## 1. Produktgesetz (verbindlich)

1. **Mobile defines priority.** Primäre Prüfgrößen: 390 × 844, 412 × 915, 430 × 932.
2. **Desktop uses space, not more complexity.** Mehr Platz = Kontext, Preview, parallele Übersicht – nicht mehr UI-Lärm.
3. **Same components, different composition.** Keine parallele Desktop-App, keine `if (mobile) MobileX else DesktopX`-Duplikate der Business-UI.
4. **One primary workspace per screen.**
5. **Context becomes side rails on larger screens.**
6. **Mobile bottom navigation becomes desktop navigation** (gleiche Labels, Icons, Routes, Active State).
7. **Details use progressive disclosure.**
8. **Clever stays contextual, not permanently noisy.**
9. **Business logic is never duplicated for breakpoints.**
10. **Every core workflow must work from 390 px to wide desktop.**

## 2. Breakpoints (Single Source)

Definiert in `src/styles/variables.css` und gespiegelt in `src/components/layout/responsiveBreakpoints.js`:

| Tier | Token | Wert |
|------|-------|------|
| Mobile | `--bp-mobile-max` | &lt; 768 px |
| Tablet | `--bp-tablet` | ≥ 768 px |
| Desktop | `--bp-desktop` | ≥ 1100 px |
| Wide | `--bp-wide` | ≥ 1440 px |

Legacy-Aliase: `--bp-sm` (640), `--bp-md` (768), `--bp-lg` (1024), `--bp-phone-column` / `--cn-page-max` (480).

## 3. Content-Width Tokens

| Token | Zweck | Ausgangswert |
|-------|--------|--------------|
| `--content-reading` | Chat-/Formular-Lesebreite | 720 px |
| `--content-workspace` | Workspace / Admin Grid | 1200 px |
| `--content-wide` | Wide Desktop Shell | 1400 px |
| `--sidebar-context` | Linke Kontextspalte | 260 px |
| `--sidebar-assistant` | Rechte Clever-Spalte | 300 px |
| `--sidebar-nav` | Desktop Icon-Rail | 72 px |
| `--cn-page-max` | Phone-Column (Portal/legacy) | 480 px |
| `--max-width` | Marketing Container | 1120 px |

## 4. Layout Primitives

| Primitive | Datei | Verwendung |
|-----------|--------|------------|
| Tokens + Utilities | `src/styles/responsive-foundation.css` | global importiert via `index.css` |
| `ResponsivePageShell` | `src/components/layout/ResponsivePageShell.jsx` | reading / workspace / wide / phone |
| `WorkspaceShell` | `src/components/layout/WorkspaceShell.jsx` | Seitentyp A – Context \| Main \| Assist |
| `CleverMoment` | `src/components/layout/CleverMoment.jsx` | gleiche Komponente Mobile inline / Desktop Rail |
| `useViewportTier` | `src/components/layout/useViewportTier.js` | Composition-Hints (keine Business-Zweige) |
| `CustomerAkteFileNav` | bottom + `variant="rail"` | semantisch identische Nav |

CSS-Klassen: `.cn-page--*`, `.cn-workspace`, `.cn-split-preview`, `.cn-card-grid`, `.cn-form-rail`, `.cn-sticky-composer`, `.cn-side-rail`.

## 5. Seitentypen

| Typ | Beispiele | Mobile | Desktop |
|-----|-----------|--------|---------|
| **A Conversational** | Verkäufer-Kundenakte, Shared Chat, Portal-Kommunikation | 1 Spalte + Bottom Nav | Context \| Workspace \| Clever (+ Side Rail) |
| **B Intake / Beratung** | Dealer Homepage Clever, Showroom, Modellorientierung | Conversation-first | Conversation + optional Kontext, Chat nicht überbreit |
| **C Angebotsvorbereitung** | Seller Offer Prep | vertikal Input→Review→Send | Input \| Live Preview |
| **D Angebotsraum** | Kundenportal Angebote | Cards untereinander | 2–3 Card Grid |
| **E Unterlagen / SA** | Docs, Self Disclosure | Step-by-step | Formularbreite begrenzt, optional Progress |
| **F Admin** | Leitstand, Backend Hub | KPI Cards + Listen | dichteres Grid, Tabellen nur wenn nötig |
| **Public Dealer** | Händler-Landing | mobile-first CX | breiter Web-Container, **keine** Backend-Nav |

## 6. Route Audit (Kern)

| Route | Seitentyp | Ziel-Layout | Status Foundation |
|-------|-----------|-------------|-------------------|
| `/haendler/:slug`, `/` subdomain | Public / B | Reading→Wide Marketing | Tokens; Landing nutzt `--content-reading` für Journey |
| `/sales`, `/gespraech`, Beratung | B | Conversation + Kontext | Folgephase |
| `/mein-bereich/angebote/:code` | D / A | Workspace + Card Grid | Portal Shell → `--content-*`, Offer Grid Desktop |
| `/backend/kundenakte/:leadId` | A | WorkspaceShell triple | **umgesetzt** |
| `/communication/*` | A | Workspace | Folgephase (gleiche Primitives) |
| `/backend/angebot-vorbereiten` | C | `.cn-split-preview` | Primitives bereit |
| `/customer/self-disclosure/:token` | E | `.cn-form-rail` | Primitives bereit |
| `/admin/*` Leitstand | F | Content Workspace | max-width Tokens |
| `/backend` Hub | F | BackendNav Grid | Folgephase |
| `/fahrzeuge`, `/fahrzeug/:slug` | Public | Discovery wide | Folgephase |

## 7. Golden Tests

### Kundenakte Mobile
Header → Chips → Chat → Composer → Bottom Nav (Kunde | Chat | ✨ | Angebote | Mehr)

### Kundenakte Desktop (≥1100)
Side Rail + Context (Kunde/Wünsche) | Chat + Composer | Clever Moment – **keine** Bottom Nav

### Angebot
Mobile: vertikal · Desktop: Input | Preview (`.cn-split-preview`)

### Customer Intake
Mobile: Chat-first · Desktop: Conversation zentral, Kontext optional, max. Lesebreite

## 8. Migration (Phasen)

1. **Global Shell / Tokens / Breakpoints** – erledigt (diese Foundation)
2. **Verkäufer-Kundenakte / Shared Workspace** – Desktop-Composition angebunden
3. **Customer Intake / Dealer Page** – schrittweise Tokens + Conversation-Width
4. **Angebot / Kundenportal** – Grid + Content-Width begonnen
5. **Documents / Self Disclosure** – Form-Rail anbinden
6. **Admin / weitere Screens** – Token-Widths begonnen

Nach jeder Phase: Tests + visuelle Prüfung 390 / 412 / 768 / 1024 / 1280 / 1440.

## 9. Referenzen

- `docs/CLEVER_CONVERSATION_UI.md`
- `docs/CLEVER_SELLER_ASSISTANT.md`
- `docs/CLEVER_CUSTOMER_PORTAL.md`
- `docs/CLEVER_MANIFEST.md`
- `src/styles/variables.css`
- `src/styles/responsive-foundation.css`

## 10. Nicht tun

- separate Desktop-App
- komplette Mobile-Seitenkomponenten für Desktop duplizieren
- Desktop dauerhaft auf `max-width: 480/600` zentrieren, wo Workspace sinnvoll ist
- jede Seite zwanghaft dreispaltig
- Business-Logik im Responsive-Refactor ändern
- Navigation doppelt (Bottom + Side gleichzeitig sichtbar)
