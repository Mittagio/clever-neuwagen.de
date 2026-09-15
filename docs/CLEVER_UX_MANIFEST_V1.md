# Clever UX Manifest V1

**Status:** FREEZE – verbindlich für alle Seller-Sales-Workspace-UI-Entscheidungen  
**Stand:** September 2026  
**Grundlage:** Benchmark HubSpot · Pipedrive · Attio · Salesforce Agentforce · Close  

**Kein Feature-Auftrag.** Dauerhafte Produkt-/UX-Regel.

---

## Leitlinie

> **Der Verkäufer soll nicht das CRM bedienen.  
> Clever soll das CRM für den Verkäufer bedienen.**

Clever ist kein klassisches CRM mit KI-Funktionen.  
Clever ist ein **vertikaler Sales Assistant** für den Autohandel.

| Verkäufer | Clever |
|-----------|--------|
| spricht / tippt | versteht |
| führt Kundengespräch | hält Kundenwissen aktuell |
| bestätigt Risiken | verdichtet Kontext |
| | erkennt offene Punkte |
| | bestimmt genau die nächste sinnvolle Handlung |
| | bereitet diese vor |
| | bedient CRM / Offer / Portal im Hintergrund |

---

## Geltungsbereich

**Gilt für Seller-Flächen**, insbesondere:

- Global Composer / Intake  
- Kundenakte / Clever-Tab  
- CleverEmpfiehlt / WorkBriefing  
- Offer Review / Handoff  
- Change Request  
- Today / Verkäufer-Dashboard  
- Angebote / Tracks (als Detail)  
- Portal / Unterlagen (als Detail)  
- Aktivitäten (sekundär)

**Gilt nicht als Ersatz** für:

- Kundendialog / Zwei Welten → [Vier Aufgaben](CLEVER_FOUR_TASKS.md), [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md), [Customer Intake Manifest](CLEVER_CUSTOMER_INTAKE_MANIFEST.md)  
- Optik (Lavender, Typo, Spacing) → [UI Filigree](CLEVER_UI_FILIGREE.md), [Responsive Design](CLEVER_RESPONSIVE_DESIGN.md)  
- Architektur-Freezes (Working Draft, Zero-Loss, Vehicle Identity, Capture-then-Offer) → jeweilige Freeze-Docs/Rules  

Bei Widerspruch zwischen **Customer-Produktprinzipien** und diesem Manifest:  
Customer-Gesprächsregeln gelten für **Kunden-UI**; dieses Manifest gilt für **Verkäufer-Workspace-UI**. Kein Konflikt – zwei Oberflächen.

---

## Dokument-Hierarchie (Seller UX)

1. [Manifest](CLEVER_MANIFEST.md) – Verfassung  
2. [Vier Aufgaben](CLEVER_FOUR_TASKS.md) – Verständnis-Kern (gesamt)  
3. [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md) – Produktentscheidungen (v. a. Kundendialog)  
4. **Dieses Dokument – Seller Sales Workspace UX**  
5. Surface-Freezes (Intake Presenter V1, Offer Review Phase 1 Hierarchy, Working-Draft-Core, Dual Input / Single State, …)  
6. Code  

Cursor-Rule: `.cursor/rules/clever-ux-manifest-v1.mdc`  
Dual-Input-Regel: `.cursor/rules/clever-dual-input-single-state.mdc` · [CLEVER_DUAL_INPUT_SINGLE_STATE.md](CLEVER_DUAL_INPUT_SINGLE_STATE.md)

---

## 10 verbindliche UX-Prinzipien

### 1. Kontext vor Feldern

WorkBriefing / Hero / Summary zuerst.  
Rohdaten, Properties, Facts, technische Felder nur in Details.  
Normalzustand: **lesen und verstehen** – nicht Formular bedienen.

### 2. Genau eine fachliche Primary Action

Primary kommt aus `determineNextBestSellerAction` (bzw. dem Screen-äquivalenten NBA-Pfad).  
Keine zweite gleichwertige Action daneben.  
Andere Aktionen: Secondary · Utility · Details.  
Nie mehrere gleich starke Next Steps.

### 3. Lesen vor Bearbeiten

Normalzustand = Arbeitsstand.  
Edit hinter Details / lokal / nur wenn nötig.  
Keine permanente Bearbeiten-/Bestätigen-/Korrigieren-/Übernehmen-/Verwerfen-Metapher.

### 4. Progressive Disclosure

First Screen bleibt dünn: Kunde · Wunsch · offen · Next Step.  
Details on demand. Nicht alles gleichzeitig.

### 5. AI im Workflow, nicht als Labor

Keine sichtbare KI-Technik im Normalzustand: „Von Clever erkannt“, Fact-Chip-Wolken, Confidence, AI Review, Recognition Status.  
Clever wirkt intelligent, ohne interne Interpretation zu erklären.

### 6. Partial Success

7 von 8 Facts sicher → 7 speichern, 1 lokal markieren.  
Nie den ganzen Turn blockieren. Kein globales Review wegen eines unsicheren Slots.

### 7. Capture then Offer

Zuerst Kundenwissen. Danach Offer vorbereiten.  
Keine Fake-Rate, kein erfundenes Modell, kein künstlicher Offer-Draft ohne Grundlage.  
Siehe [CLEVER_CAPTURE_THEN_OFFER.md](CLEVER_CAPTURE_THEN_OFFER.md).

### 8. Today = Focus Queue

Today/Dashboard ist keine KPI-Wand.  
Ziel: „Wen sollte ich heute bearbeiten und warum?“ – 3–5 priorisierte Personen/Aktionen.  
Nicht: Widget-Grid + Zahlen + Pipeline-KPIs als Hauptarbeitsfläche.

### 9. Clever bedient das CRM

Verkäufer pflegt keine Felder, sucht keine Pipeline-Stages, überträgt keine Daten zwischen Screens.  
Clever schreibt strukturiert im Hintergrund. Arbeit = Sprache + Kontext + Next Step.

### 10. Vertical verdichten, Horizontal weglassen

Automotive-Komplexität (Modell, Trim, Motor, Batterie, Pakete, Leasing/Finanzierung, Laufzeit, km, AZ, Rate, Trade-in, Probefahrt, Lieferzeit, Unterlagen, Portal, Angebotsänderungen) bleibt **im Hintergrund**.  
Vorne: ruhiger Sales Workspace.

---

## 3-Sekunden-Test

Jeder zentrale Clever-Seller-Screen muss in 3 Sekunden beantworten:

1. Wo stehe ich?  
2. Was will der Kunde?  
3. Was ist offen?  
4. Was tue ich jetzt?  

Wenn nicht → UI zu komplex → erst vereinfachen.

---

## Screen-Grundmuster

Alle Sales-Flächen:

```
Briefing
→ genau eine Primary
→ lokale offene Punkte
→ Composer / Utility
→ Details nachgelagert
```

---

## Anti-Patterns (Normalzustand)

- Chip-Wolken  
- Excel-/Tabellen-Feeling  
- Fact Review als Default  
- Confirm / Apply / Discard als Dauerzustand  
- viele Badges  
- mehrere gleich starke Buttons  
- technische KI-Sprache  
- doppelte Informationen  
- Pipeline-Zähler im Kundenkontext  
- Editing als Default  
- AI als separate Box  
- CRM-Navigation vor Kundenkontext  

---

## Referenz-Muster (Prinzipien, nicht Kopien)

| Produkt | Übernehmen als Prinzip |
|---------|------------------------|
| HubSpot | Summary zuerst · Guided Selling · Suggested Updates · NBA |
| Pipedrive | Deal als Arbeitseinheit · Next Activity · Focus View |
| Attio | ruhige Record Pages · Progressive Disclosure · Kontext vor Feldern |
| Salesforce | NBA inline · Agent im Deal-Kontext (ohne Enterprise-Komplexität) |
| Close | Arbeitsqueue statt Dashboard |

**Nicht 1:1 kopieren** – Texte, Designs, Komponenten fremder Produkte nicht übernehmen.

---

## Bewusst nicht bauen

- generisches Custom-Object-CRM  
- Salesforce / Data-Cloud-Klon  
- Marketing-Automation-Suite  
- Attio-Schema-Builder  
- Forecast-/Coaching-Plattform  
- Pipeline als Hauptarbeitsfläche der Kundenakte  
- separates KI-Panel  
- AI-Credit-Ökosystem  
- Dialer-first CRM  

---

## Cursor-Check vor jeder UI-Änderung

1. Muss der Verkäufer das jetzt sehen?  
2. Ist das Kontext oder Rohdaten?  
3. Kann daraus eine menschliche Zusammenfassung werden?  
4. Gibt es genau eine Primary Action?  
5. Wird CRM-Arbeit sichtbar, die Clever verstecken sollte?  
6. Ist Detailtiefe progressiv?  
7. Ist Unsicherheit lokal?  
8. Besteht der 3-Sekunden-Test?  

Wenn nein → erst UI vereinfachen. Keine neue Architektur „für die Optik“.

---

## Verhältnis zu Design-/Architektur-Freezes

| Freeze / Doc | Rolle neben diesem Manifest |
|--------------|-----------------------------|
| Working-Draft-Core, Zero-Loss, Offer Identity, Offer Intake, Capture-then-Offer | Architektur/Daten – bleiben; UX Manifest steuert **Darstellungshierarchie** |
| Dual Input / Single State | Klick + Composer → **eine** Wahrheit; unterliegt denselben 10 Prinzipien + Primary-CTA |
| Intake Presenter V1 UX Freeze | Spezialfall Intake – unterliegt denselben 10 Prinzipien |
| Offer Review Phase 1 | Spezialfall Offer – unterliegt denselben 10 Prinzipien |
| Composer Brain DoD „Design Freeze“ | Kein Layout-/Visual-System-Redesign; Hierarchie-Vereinfachung **im Sinne dieses Manifests** ist erlaubt und erwünscht |
| Clever 2.0 „UI einfrieren“ | Kein paralleler Redesign-Track; Entscheidungen an diesem Manifest messen |

---

## Verwandte Docs

- [CLEVER_DUAL_INPUT_SINGLE_STATE.md](CLEVER_DUAL_INPUT_SINGLE_STATE.md)  
- [CLEVER_2_0_ASSISTANT_GAP_AUDIT.md](CLEVER_2_0_ASSISTANT_GAP_AUDIT.md)  
- [CLEVER_COMPOSER_BRAIN_DOD.md](CLEVER_COMPOSER_BRAIN_DOD.md)  
- [CLEVER_GLOBAL_COMPOSER.md](CLEVER_GLOBAL_COMPOSER.md)  
- [CLEVER_INTAKE_PRESENTER_V1_UX_FREEZE.md](CLEVER_INTAKE_PRESENTER_V1_UX_FREEZE.md)  
- [CLEVER_CAPTURE_THEN_OFFER.md](CLEVER_CAPTURE_THEN_OFFER.md)  
- [CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md](CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md)  

---

*Geschrieben als dauerhafte UX-Verfassung für den Verkäufer-Workspace – nicht als Feature-Liste.*
