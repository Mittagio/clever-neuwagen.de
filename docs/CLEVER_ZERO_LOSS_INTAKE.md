# Clever Zero-Loss Intake

## Ziel

Alles reinwerfen → Clever strukturiert → nichts geht verloren.

## Zustände

| Bucket | Bedeutung |
|--------|-----------|
| structured_customer_fact | Mensch & Alltag (Kinder, Hund, …) |
| vehicle_preference | Wunschfahrzeug, Farbe, Trim |
| commercial_preference | Rate, AZ, Laufzeit, km |
| existing_vehicle_or_trade_in | Bestandsfahrzeug / GW |
| equipment_or_technical_need | Ausstattung / technische Bedürfnisse |
| personal_note | bewusste Notiz |
| prepared_action | vorbereitete Aktion |
| unresolved_note | noch nicht sicher klassifizierbar – Text bleibt |

## Partial Success

5 sichere Fakten + 1 unsicheres Modell → 5 übernehmen, nur Modell klären. Nie den ganzen Turn blockieren.

## EQ2 → EV2

Unsaubere Sprache darf normalisiert werden, wenn die verifizierte Registry das Mapping stützt. Sonst Ambiguity mit `rawExpression` behalten.

## Verkäufer-Kurzschrift

**Pattern-Freeze: Seller Shorthand / Fuzzy Input V1 · Status: pilotfähig**

> LLM liest Verkäufer-Slang.  
> Seller Alias Registry normalisiert Fachkürzel.  
> Vehicle Catalog validiert Wahrheit.  
> Apply speichert nur sichere Werte.  
> Unsicherheit bleibt lokal.

Kontrollierte Normalisierung / Alias-Ebene vor bestehender Validierung – kein freies Fuzzy, keine Sonderregel pro Tippfehler/Teststring. Weitere Fälle nur aus echter Verkäuferrealität (neues Muster ja/nein → systemisch fixen → Golden).

Kern: `src/services/cleverSeller/sellerAliasRegistry.js`  
Golden: `src/services/cleverSeller/sellerAliasShorthand.golden.test.js`  
Validierung: `validateOfferPackageAgainstCatalog` / `validateOfferPowerAgainstCatalog` / `validateOfferEquipmentAgainstCatalog` in `offerVehicleIdentity.js`.

## Free Speech / Dictation Intake

**Pattern-Freeze: Free Speech / Dictation Intake V1 · Status: pilotfähig**

> Lose Satzfetzen → strukturierter Verkaufsstand. Rolle vor Wert. Kontext vor Keyword.

- Bestandsmarker → `existingVehicle` (nicht Interest)
- Spannen bleiben Spannen (`termMonthsVariants`, `downPaymentRange`)
- Persönliche Notiz ≠ Fahrzeugfarbe
- Commercial ohne Modell → Consultation, kein Concept Draft

Golden: `src/services/cleverSeller/brandesFreeSpeech.golden.test.js`  
Rule: `.cursor/rules/clever-free-speech-dictation-v1.mdc`

## DoD

Der Verkäufer weiß nach dem Gespräch: alles ist einsortiert oder wenigstens als Notiz erhalten.

## Human-in-the-loop (komplexe Anfragen)

> Sichere Fakten werden automatisiert.  
> Komplexe Anforderungen werden verdichtet.  
> Verkaufsentscheidungen trifft der Verkäufer.

- WLTP / Reichweite → `rangeNeed`, nie `annualMileage`
- effektiver Jahreszins → Finance-Wunsch, nie Rabatt
- Vergleichsmodelle → `modelCandidates` / `vehicleInterestMulti` mit `consultationCandidates`, nie `existingVehicle` ohne Besitzkontext
- Mehrere Kandidaten ohne Fokus → Consultation-NBA („Passende Fahrzeuge finden“), kein Concept Draft
- Bewusste Modellwahl (z. B. „EV4“) → `selectedModelKey` + ein Concept Draft; Kandidaten bleiben Kontext

## Verwandt

- [CLEVER_CAPTURE_THEN_OFFER.md](./CLEVER_CAPTURE_THEN_OFFER.md) – zuerst Capture, dann Angebotstool; Wunsch-Budget ≠ Bankrate
- [CLEVER_COMPOSER_BRAIN_DOD.md](./CLEVER_COMPOSER_BRAIN_DOD.md) – Dump First-Class
- [CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md](./CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md) – Track / Rate prüfen
