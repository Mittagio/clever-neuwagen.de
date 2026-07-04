# Experiments

**Hier landen Ideen, bevor sie Produkt werden.**

Nicht jede gute Idee gehört sofort in den Code.  
Dieser Ordner ist der Raum zum Testen — mit echten Menschen, nicht mit Unit-Tests.

## Regel

1. Idee hier dokumentieren
2. Mit Menschen testen (siehe [clever-user-testing.md](../docs/clever-user-testing.md))
3. Erst dann entscheiden: Produkt, verwerfen, oder weiter experimentieren

**Nichts aus diesem Ordner geht automatisch live.**

## Ideen-Backlog (noch nicht gebaut)

| Experiment | Hypothese | Status |
|------------|-----------|--------|
| Spracheingabe | Wünsche lassen sich natürlicher sprechen als tippen | Idee |
| Fotos vom aktuellen Auto | Kontext ohne Fragenkatalog | Idee |
| Führerschein scannen | Weniger Tippen, mehr Vertrauen | Idee |
| Haustier-Erkennung | Alltagssituation verstehen (Transport, Platz) | Idee |
| Familienmodus | Mehrere Nutzer, ein Wunschprofil | Idee |
| Tesla-Wechselberater | Wechselmotivation verstehen, nicht Modelle vergleichen | Idee |

Neue Experimente: Unterordner anlegen (`experiments/<name>/README.md`) mit Hypothese, Testplan und Ergebnissen.

## Was gerade nicht weiterentwickelt wird

Der magische Flow unter `/beratung` ist **feature-complete für Phase 1**:

Wunsch erzählen → Clever notiert → EV3-Empfehlung → EV3-Fahrzeugberatung → persönliche Übergabe

**Jetzt testen. Nicht erweitern.**
