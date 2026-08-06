# Clever UI Filigree – Premium Visual Law

**Stand:** 2026-08-06  
**Status:** verbindlich für Desktop und Mobile  
**Scope:** Visual Polish only – **keine neuen Features**, keine neue Business-Logik

Referenz-Mockups:
- Kundenakte „Herr Notz“ (filigrane Premium-SaaS-Richtung, allgemein)
- Kundenakte **„Kai Drechsel“** (Kundenbild-Layout: Kern → Wissen → Clever → Composer)

---

## Leitsatz

> **Nicht mehr Features sichtbar machen, sondern vorhandene Informationen filigraner, ruhiger und näher an einem Premium-SaaS darstellen.**

---

## Kundenakte Kundenbild – Kai-Drechsel-Vorlage (verbindlich)

Visuelle Vorlage für die Kundenakte. **Kein Feature-Umbau** – nur Optik/Layout an bestehender Architektur.

### Vertikale Reihenfolge (strikt)

```text
Header (Name · Kontaktwarnung)
↓
1  Kernkonditionen     – warmer Beige-Strip, immer sichtbar
↓
2  Kundenwissen        – Lavendel-Zone, klappbar, editierbare Chips
↓
   ~22–28px Weißraum
↓
4  Clever empfiehlt    – eigene Action-Card (Lavendel-Akzent, lila CTA)
↓
5  Composer + Bottom-Nav
```

### Zwei Zonen (Farbtrennung)

| Zone | Fläche | Inhalt |
|------|--------|--------|
| **Kernkonditionen** | Warm/Beige `#f8f3ea` … `#faf6ef` | Deal-Fakten (Laufzeit, km, Anzahlung, Ende) |
| **Kundenwissen** | Lavendel `#ece8f8` / `#f0ecfa` | Mensch, Fahrzeugpräferenz, Ausstattung, Prioritäten |

### Chip-Regeln

- Klein, ruhig, editierbar (Tap → Mini-Editor)
- Priorität als Punkt + Label (`muss` / `wichtig`), nicht als dicke Badge
- Line-Icons statt Emojis
- Keine große Outer-Card um Kern + Wissen

### Clever-Action

- Optisch **getrennt** vom Infoblock (Abstand, eigene Card)
- Primär-CTA in Clever-Lavender (`#6d5bb8`), nicht Navy-Schwarz
- 1 Hinweis, 1 Primäraktion – kein Copilot-Roman

### Code-Anker

- `CustomerAkteKundenbild.jsx` / `.css` – Kern + Soft
- `CleverEmpfiehltCard.jsx` / `.css` + `SharedWorkspaceChat` Empty-Recommend
- Daten: `buildCustomerSnapshotModel.js` (unverändert in der Logik)

---

## Visuelle Regeln (verbindlich)

| Regel | Umsetzung |
|-------|-----------|
| Sehr dünne Borders | `1px`, sehr helles Grau – keine dicken Rahmen |
| Fast keine Schatten | Flat / leicht geschichtet über Flächenfarbe, keine „Card-Schatten-Berge“ |
| Weißraum mit Absicht | Luftig, aber kein leerer Dashboard-Wüste |
| Kleine, ruhige Chips | Kompakt, wenig Farbe, keine dicken Pills |
| Line-Icons statt Emojis | Einheitliches Line-Icon-Set in Nav, Header, Aktionen |
| Wenig Farbe | **Navy** für Text/Primär · **sehr dezentes Lavender** nur für Clever |
| Chat = Hauptfläche | Verlauf dominiert – kein CRM-Stapel darüber |
| Kundeninfos immer sichtbar | Mobile: Header + Chip-Zeile · Desktop: Context-Rail |
| Clever situativ & klein | 1 Hinweis, 1 Aktion – kein Copilot-Roman |
| Keine dicken Kartenstapel | Keine Dashboard-Kachelei |
| Desktop 2–3 leichte Zonen | Context \| Chat \| Clever – filigran, nicht „Admin-Panels“ |
| Mobile eine Vertikale | Header → Chips → Verlauf → Composer → Bottom Nav |

---

## Farbrichtung (Ziel-Tokens)

Ausgangswerte für den Visual-Polish-Pass (in `variables.css` verankern, nicht pro Seite hardcoden):

```text
Navy (Text / Nav aktiv):     ~ #0B1736 / #1e1b4b
Muted Meta:                  ~ #64748b / #94a3b8
Border filigree:             ~ #e8e8ef / #ececf3
Surface:                     #ffffff
Soft grey (Kunde-Bubble):    ~ #f4f4f7
Clever Lavender (dezent):    ~ #ece8f8 / #ddd6fe (Fläche)
Clever Lavender (Akzent):    ~ #7c6db5 / #6d5bb8 (Icon, aktiver Tab, Send)
Warn/Status sparsam:         Rot/Orange nur bei „fehlt“ / offen
```

---

## Layout-Gerüste (unverändert strukturell)

### Desktop

```text
┌─────────────┬──────────────────────────────┬──────────────┐
│ Kunde       │ Chat / Verlauf               │ Clever       │
│ Chips       │ Nachrichten · Angebote       │ 1 Hinweis    │
│ Status      │ Dokumente                    │ 1 Aktion     │
│ Kontakt     │ Composer                     │              │
└─────────────┴──────────────────────────────┴──────────────┘
```

### Mobile

```text
Herr Notz
[ AHK ] [ HUD ] [ Sofort verfügbar ] [ Konditionen 3 ]
────────
Chat / Verlauf
────────
+ Nachricht schreiben oder Clever fragen · Mic · Send
────────
Kunde | Chat | Clever | Angebote | Mehr
```

Optik: exakt so fein wie das Mockup – kaum visuelle Schwere.

---

## Was ein Visual Polish Pass darf

- Tokens (Farben, Borders, Radii, Chip-/Bubble-Styles)
- Typography-Gewicht / Abstände
- Icon-Austausch (Emoji → Line-Icons), wo Icons schon vorgesehen sind
- Schatten reduzieren, Borders dünner
- CleverMoment / Composer / Bottom-Nav / Chat-Bubbles optisch angleichen
- Bestehende Komponenten **restylen**, nicht ersetzen

## Was ein Visual Polish Pass **nicht** darf

- Neue Features, neue Tabs, neue Module
- Business-Logik, Orchestratoren, APIs ändern
- Desktop- und Mobile-Apps duplizieren
- Mehr permanente Blöcke einbauen „weil Platz da ist“
- Zurück zu dicken CRM-Karten / Schatten-Stacks

---

## Status

**Visual Quality Reset v1.0 (2026-07-25):** Tokens auf Navy + dezentes Lavender, Line-Icons in File-Nav/Header, Desktop-Shell `flex-direction: row`, Score in Clever-Card ausgeblendet, Chat/Composer/Assist beruhigt.

**Kundenbild Kai-Drechsel-Vorlage (2026-08-06):** Kern warm/beige, Kundenwissen Lavendel, Prioritäts-Dots, Clever-CTA in Lavender, Abstand Wissen → Clever.

## Verwandte Docs

- [CLEVER_RESPONSIVE_DESIGN.md](CLEVER_RESPONSIVE_DESIGN.md) – Breakpoints & Workspace-Composition
- [CLEVER_CONVERSATION_UI.md](CLEVER_CONVERSATION_UI.md) – Messenger-Struktur
- [CLEVER_PRODUCT_PRINCIPLES.md](CLEVER_PRODUCT_PRINCIPLES.md) – Produktentscheidungen
- [CLEVER_MANIFEST.md](CLEVER_MANIFEST.md) – Verfassung

---

## Nächster Auftrag (Vorlage)

Siehe Abschnitt unten in Chat-Antwort bzw. Prompt:

**„AUFTRAG: CLEVER VISUAL POLISH / PREMIUM UI PASS – nur Optik, keine Features.“**
