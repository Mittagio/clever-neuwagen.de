# Clever Pilot – Go / No-Go

**Stand:** August 2026  
**Ziel:** Entscheidung Pilot-Launch (**Verkäuferassistent 2.0**), NICHT „komplettes Händlerbetriebssystem“.

Siehe: [CLEVER_PILOT_LAUNCH_CHECKLIST.md](./CLEVER_PILOT_LAUNCH_CHECKLIST.md) (Smoke) · [CLEVER_GLOBAL_COMPOSER.md](./CLEVER_GLOBAL_COMPOSER.md) (Surfaces / Propose→Confirm)

---

## Claim nach außen

**Darf gesagt werden:** Clever ist ein Verkäuferassistent, der Dump/Paste versteht, Vorschläge zeigt und erst nach Confirm handelt – inkl. Portal, Inbox, Nachfolge und Admin-Leitstand im Pilot-Scope.  
**Nicht sagen:** WhatsApp-API, DMS-Anbindung, echte Kalender-OAuth-Buchung, voller Vertragsabschluss oder „Clever betreibt den Händler allein“. OpenAI ist Unterstützung mit Fallback, kein stiller Auto-Send.

---

## Go-Kriterien

Vor Launch alle Checkboxen grün (manuell prüfbar; Smoke aus Launch-Checkliste + August-Features).

- [ ] **Smoke Brandes end-to-end** – Launch-Checkliste Smoke 1–10 ohne Blocker (Dump→Review→Übernehmen; Nachricht; Kundenlink; Inbox→Composer; PDF; Nachfassen; Magic; Portfolio-Share; Spezialfrage; Backend→Magic).
- [ ] **Propose→Confirm, nirgends Auto-Send** – Nachricht, Termin, Portfolio, Unterlagen, Magic: immer Review/Confirm vor Aktion; kein stiller Versand/Buchung.
- [ ] **Global Composer Surfaces** – Dashboard + Kundenakte nutzen denselben Orchestrator; Seed/Handoff konsistent (kein zweites „Clever-Gehirn“).
- [ ] **Magic Flags / OpenAI-Fallback** – Magic-Handoff öffnet Review; unklarer Freitext mit Flag → „Clever prüft …“ → Review; ohne Flag kein Absturz.
- [ ] **Kein Stillstand ohne OpenAI** – OpenAI aus/Fehler: Kernpfade (Review, Nachricht, Magic-Entry, Inbox) bleiben bedienbar.
- [ ] **Golden Path Portal** – Kundenlink → Portal-Reaktion → Composer mit Seed → Senden → zugehöriges Inbox-Item erledigt.
- [ ] **Inbound Paste** – Forward/Paste → `inbound_lead_review` → Übernehmen → Lead/Akte nutzbar.
- [ ] **Kundenantwort Paste** – Paste/Forward → `customer_reply_review` → Composer/Antwort-Flow ohne Auto-Send.
- [ ] **Unterlagen fehlt-noch** – CTA „Unterlagen fehlen“ / Paket → Composer → Confirm → Versand/Inbox-Update.
- [ ] **Nachfolge Heute / Golden** – Heute-Worklist bzw. Golden → `prepare_followup_offer` → Composer → Confirm (kein Auto-Send).
- [ ] **Admin Leitstand** – `/admin` zeigt Kernsignale (Pilot-relevant: Fehler/Queues/Flags sichtbar genug zum Steuern).
- [ ] **Verantwortlicher + Feedback-Kanal** – benannte Person + Kanal für Pilot-Bugs (Slack/Ticket); Kalender-Hook & OCR bewusst optional, blockieren Launch nicht.

---

## No-Go / bewusst out of scope

Blockiert den Pilot **nicht**; darf aber **nicht** als Claim verkauft werden:

- WhatsApp Business API / offizielle Messenger-Anbindung  
- DMS-/ERP-Integration  
- Auslieferungs- und Aftersales-Betrieb  
- Echte Kalender-OAuth (Google/Outlook) – Hook/Status optional, keine stille Buchung  
- Voller Vertragsabschluss / Auto-Apply ohne Review  
- Produktiv-OCR Pflicht (OCR optional, Flag)  
- „Komplettes Händlerbetriebssystem“

---

## Entscheidung

| Lage | Aktion |
|------|--------|
| Alle Go-Kriterien grün | **Launch** Pilot Verkäuferassistent 2.0 |
| Ein Kriterium kritisch rot (Smoke-Blocker, Auto-Send, Stillstand ohne OpenAI, kein Feedback-Kanal) | **Verschieben** – Fix + erneuter Go-Check |
| Nur optionale Lücken (Kalender-OAuth, OCR, DMS, WhatsApp) | **Kein No-Go** – Scope klarhalten, Claim nicht erweitern |

**Regel:** Erst Launch, wenn Propose→Confirm und Smoke Brandes halten; Out-of-Scope nie als Featureversprechen nach außen.
