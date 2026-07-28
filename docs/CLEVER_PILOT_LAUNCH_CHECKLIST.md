# Clever Pilot Launch – Checkliste

**Stand:** Juli 2026  
**Ziel:** CRM mit KI-Unterstützung – Verkäufer-Loop zuerst, Fehler später sammeln.

## Fertig (durchgezogen)

| Schritt | Inhalt |
|---------|--------|
| Composer sticky | Desk unten fixiert |
| Universal Review | Dump → „Clever hat verstanden“ → Übernehmen |
| Freitext | Lieferzeit, Farbe, Rabatt, Outlook-Paste |
| PDF im Composer | Reinwerfen / Drag&Drop → Review |
| Angebot Postfach | „Angebot ist da! Schau nach.“ |
| Message-Pfad | „Schreib ihm …“ → Nachricht, kein Offer-Dump |
| Review-Handoff | Übernehmen → Angebot vorbereiten / Nachricht senden |
| Portal Antworten | → Composer mit Seed |
| Strukturierte Übernahme | Wunschrate, km, Telefon, needProfile nach Review |
| Heute-Worklist | `buildSellerTodayWorklist` + Follow-up inkl. überfällig |
| Magic-Handoff | Review/Composer → `magic-offer-review` (nicht mehr abgeschnitten) |
| Composer → Portfolio | „Schick ihm die Angebote“ → Kundenlink-Sheet |
| CleverAntworten → Composer | Inbox/Empfehlungen/Deep-Links öffnen Composer mit Seed |
| OpenAI-Eskalation (optional) | Flag aus; bei Lücken Server-Interpret + Review (kein Auto-Persist) |
| CleverAntwortenSheet entfernt | Datei gelöscht; Antworten nur noch Composer |
| Bugfixes Seller-Loop | Stale OpenAI-Race, Inbox nach Send, Review bestätigt unsichere Facts, Magic-Handoff ohne Toast-No-Op |
| Parser-Feinschliff | Portfolio ≠ Message-Mode; isoliertes „21 %“ braucht Bestätigung; Magic-Entry statt No-Op |
| Backend-Akte Parity | Angebot ohne Magic → Kalkulator/Magic-Entry (kein stiller No-Op) |
| Portal-Antwort → Inbox | Composer-Antwort markiert zugehöriges Inbox-Item erledigt |
| Inbox-Composer Thread | Send nutzt threadId/offerId/questionId aus Deep-Link |
| Deep-Link Seed | Fragentext aus Inbox/Message im Composer-Seed |
| Portfolio + Kontext | Gemischter Dump öffnet Review; reiner Portfolio-Cue bleibt Inline |
| Review-Accept Aktionen | Termin / Unterlagen / Portfolio nach Übernehmen weitergeführt |
| Inbox nach Paket/Termin | onMessageSent auch bei Unterlagen-Paket und Terminvorschlag |
| Backend Magic → Review | Kundenakte-Handoff öffnet magic-offer-review im Verkaufsassistenten |
| Spezialfrage-Routing | Inbox SPECIAL_QUESTION → special_question_answer Sheet |
| Inbox Kundenakte-Link | Reply-Items behalten Composer/Inbox-Kontext |
| Review-Offer Refresh | Nach Übernehmen Magic neu mit übernommenem Lead |
| Strukturierte Facts | Rabatt, Leasingende, Lieferzeit, Automatik/Schiebedach/Trim nach Übernehmen |
| Spezialfrage senden | Gespeicherte Antwort → Composer; sentAt nach Versand |
| Magic Create ohne Parser | Bootstrap aus Lead/Grounding statt stiller No-Op |
| Wish-Save Merge | buildSavePayload überschreibt Rabatt/Leasingende nicht mehr |
| Accept Payment/Termin/Multi | paymentType, Termin, Modell-Alternativen nach Übernehmen |
| Review-Accept stale Lead | Feed nach Übernehmen überschreibt CRM nicht mehr |
| Message + Kontext → Review | „Schreib ihm …“ mit Lieferzeit/Budget öffnet Review |
| Thread-Routing hart | Ungültige threadId → Fehler statt falschem Thread |
| Paket mit replyContext | Unterlagen-Paket nutzt Inbox-Thread |
| Spezialfrage sentAt | Nur nach explizitem Antwort-Senden-Flow |
| Termin-Vorschlag hart | Kein CRM-„vorgeschlagen“ ohne gesendete Card |
| Persist paymentType | Review-Accept überschreibt Zahlungsart nicht mehr |

## Smoke (manuell, Fehler notieren)

1. Dump „netto 2800, 2 kinder, ford kuga, 300 wunschrate“ → Review → Übernehmen → Notizzettel + Rate + Leasingende
2. „Schreib ihm: Lieferzeit ca. 3 Monate“ → **Review** → Übernehmen → Nachricht senden → Kunden-Postfach
3. Kundenlink senden → Postfach „Angebot ist da!“
4. Clever Eingang „Antworten“ → Composer mit Fragentext → senden → Inbox erledigt
5. PDF Konfigurator reinwerfen → Interesse erkannt?
6. Verkaufschancen-Filter „Nachfassen“ zeigt WV heute/überfällig
7. „EV3 21 % Barangebot“ → Übernehmen → Magic-Review (nicht leerer Kalkulator)
8. Mit fertigen Board-Angeboten: „Schick ihm die Angebote per Mail“ → Share-Sheet
9. Spezialfrage aus Eingang → Wissensbasis-Sheet (nicht nur Freitext)
10. Backend-Kundenakte: Angebot aus Composer → Magic-Review im Verkaufsassistenten
11. (Optional Flag an) Unklarer Freitext → „Clever prüft …“ → Review mit needsConfirmation

## Bewusst später

- Auto-Apply ohne Review (bewusst nicht)
- Weiterer Bug-Hunt nach Pilot-Tagen
- OpenAI-Seller-Interpret in Staging aktivieren (Flag)
