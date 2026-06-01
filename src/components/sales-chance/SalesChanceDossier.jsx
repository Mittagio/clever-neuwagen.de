import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LEAD_STATUS, PAYMENT_TYPES } from '../../data/leadTypes.js';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { formatRate } from '../../logic/leadService.js';
import { buildOfferPath } from '../../logic/offerService.js';
import { getDocumentsForLead, formatExpiryCountdown } from '../../logic/salesChanceDocuments.js';
import { DOCUMENT_SLOT_LABELS } from '../../data/salesChanceTypes.js';
import {
  CUSTOMER_GROUPS,
  DISCOUNT_TYPES,
  CONTACT_PREFERENCES,
  TERM_OPTIONS,
  MILEAGE_OPTIONS,
  DEALER_SELLERS,
} from '../../data/salesChanceTypes.js';
import LeadVehicleImage from '../leads/LeadVehicleImage.jsx';
import SalesChanceQuickActions from './SalesChanceQuickActions.jsx';

function Field({ label, children }) {
  return (
    <label className="sc-field">
      <span className="sc-field__label">{label}</span>
      {children}
    </label>
  );
}

export default function SalesChanceDossier({
  lead,
  onStatusChange,
  onScrollToComposer,
  onToast,
}) {
  const {
    updateContact,
    updateWish,
    assignOwner,
    updateRateForLead,
    getPricingPreview,
    sendOffer,
    updateLeadStatus,
  } = useCommunication();
  const { offers } = useOffers();

  const [pricing, setPricing] = useState(null);
  const [busy, setBusy] = useState(false);

  const offer = useMemo(() => {
    if (!lead?.offerCode) return null;
    return offers.find((o) => o.code.toUpperCase() === lead.offerCode.toUpperCase()) ?? null;
  }, [lead?.offerCode, offers]);

  const documents = useMemo(
    () => (lead ? getDocumentsForLead(lead) : []),
    [lead],
  );

  useEffect(() => {
    if (!lead) {
      setPricing(null);
      return;
    }
    setPricing(getPricingPreview(lead.id));
  }, [lead, getPricingPreview]);

  if (!lead) {
    return (
      <div className="sc-dossier sc-dossier--empty">
        <p>Verkaufschance auswählen, um die Akte zu öffnen.</p>
      </div>
    );
  }

  const status = LEAD_STATUS[lead.status] ?? LEAD_STATUS.neu;
  const wish = lead.wish ?? {};

  async function handleUpdateRate() {
    setBusy(true);
    const res = updateRateForLead(lead.id);
    if (res.ok) setPricing(res.result);
    onToast?.(res.ok ? 'Rate aktualisiert' : 'Berechnung fehlgeschlagen');
    setBusy(false);
  }

  async function handleCreateOffer() {
    const res = sendOffer(lead.id);
    onToast?.(res.ok ? `Angebot ${res.offer?.code}` : 'Fehler beim Angebot');
  }

  function patchWish(patch) {
    updateWish(lead.id, patch);
    setTimeout(() => setPricing(getPricingPreview(lead.id)), 0);
  }

  function patchContact(patch) {
    updateContact(lead.id, patch);
  }

  async function handlePlanTestDrive() {
    await updateLeadStatus(lead.id, 'probefahrt');
    onStatusChange?.('probefahrt');
    onToast?.('Status: Probefahrt geplant');
  }

  return (
    <div className="sc-dossier">
      <SalesChanceQuickActions
        lead={lead}
        onCall={() => lead.contact.phone && (window.location.href = `tel:${lead.contact.phone}`)}
        onCreateOffer={handleCreateOffer}
        onSendMessage={onScrollToComposer}
        onPlanTestDrive={handlePlanTestDrive}
        onRequestDocument={onScrollToComposer}
        onStatusChange={onStatusChange}
      />

      <header className="sc-dossier__head">
        <LeadVehicleImage lead={lead} className="sc-dossier__img" />
        <div>
          <h2>{lead.contact.name || 'Unbekannt'}</h2>
          <span className="sc-dossier__status" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </span>
        </div>
      </header>

      <section className="sc-dossier__section">
        <h3>Kunde</h3>
        <div className="sc-dossier__grid">
          <Field label="Name">
            <input value={lead.contact.name ?? ''} onChange={(e) => patchContact({ name: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input value={lead.contact.phone ?? ''} onChange={(e) => patchContact({ phone: e.target.value })} />
          </Field>
          <Field label="E-Mail">
            <input value={lead.contact.email ?? ''} onChange={(e) => patchContact({ email: e.target.value })} />
          </Field>
          <Field label="PLZ">
            <input value={lead.contact.plz ?? ''} onChange={(e) => patchContact({ plz: e.target.value })} />
          </Field>
          <Field label="Kundengruppe">
            <select value={wish.customerGroup ?? 'standard'} onChange={(e) => patchWish({ customerGroup: e.target.value })}>
              {CUSTOMER_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Bevorzugter Kontakt">
            <select value={lead.contact.preferredContact ?? 'phone'} onChange={(e) => patchContact({ preferredContact: e.target.value })}>
              {CONTACT_PREFERENCES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Zuständiger Verkäufer">
            <select value={lead.ownerId ?? ''} onChange={(e) => assignOwner(lead.id, e.target.value || null)}>
              <option value="">Nicht zugewiesen</option>
              {DEALER_SELLERS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="sc-dossier__section">
        <h3>Wunsch & Berechnung</h3>
        <div className="sc-dossier__grid">
          <Field label="Fahrzeug">
            <input value={lead.vehicle?.label ?? ''} readOnly className="sc-readonly" />
          </Field>
          <Field label="Laufzeit (Monate)">
            <select value={wish.termMonths ?? 48} onChange={(e) => patchWish({ termMonths: Number(e.target.value) })}>
              {TERM_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Kilometer / Jahr">
            <select value={wish.mileagePerYear ?? 15000} onChange={(e) => patchWish({ mileagePerYear: Number(e.target.value) })}>
              {MILEAGE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m.toLocaleString('de-DE')}</option>
              ))}
            </select>
          </Field>
          <Field label="Anzahlung (€)">
            <input
              type="number"
              min={0}
              step={500}
              value={wish.downPayment ?? 0}
              onChange={(e) => patchWish({ downPayment: Number(e.target.value) })}
            />
          </Field>
          <Field label="Wunschrate">
            <input
              value={lead.desiredRate != null ? formatRate(lead.desiredRate) : ''}
              readOnly
              className="sc-readonly"
              placeholder="—"
            />
          </Field>
          <Field label="Zahlungsart">
            <select value={wish.paymentType ?? lead.paymentType ?? 'leasing'} onChange={(e) => patchWish({ paymentType: e.target.value })}>
              {Object.values(PAYMENT_TYPES).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Rabattart">
            <select value={wish.discountType ?? 'none'} onChange={(e) => patchWish({ discountType: e.target.value })}>
              {DISCOUNT_TYPES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <button type="button" className="sc-dossier__rate-btn" onClick={handleUpdateRate} disabled={busy}>
          {busy ? 'Berechne…' : 'Rate aktualisieren'}
        </button>
        {pricing && (
          <div className="sc-dossier__rates">
            <div>
              <span>Leasing</span>
              <strong>{formatRate(pricing.leasingRate)}/M</strong>
            </div>
            <div>
              <span>Finanzierung</span>
              <strong>{formatRate(pricing.financeRate)}/M</strong>
            </div>
            <div>
              <span>Barkauf</span>
              <strong>{pricing.cashPrice != null ? `${pricing.cashPrice.toLocaleString('de-DE')} €` : '—'}</strong>
            </div>
            <div>
              <span>Lieferzeit</span>
              <strong>{pricing.deliveryTime}</strong>
            </div>
            <div className="sc-dossier__compliance">{pricing.complianceLabel}</div>
          </div>
        )}
      </section>

      <section className="sc-dossier__section">
        <h3>Angebot</h3>
        <dl className="sc-dossier__dl">
          <div><dt>Aktuelle Rate</dt><dd>{formatRate(lead.currentRate ?? pricing?.leasingRate)}</dd></div>
          <div><dt>Hauspreis</dt><dd>{lead.listPrice != null ? `${lead.listPrice.toLocaleString('de-DE')} €` : (pricing?.listPrice ? `${pricing.listPrice.toLocaleString('de-DE')} €` : '—')}</dd></div>
          <div><dt>Lieferzeit</dt><dd>{lead.deliveryTime ?? pricing?.deliveryTime ?? '—'}</dd></div>
          <div><dt>Status</dt><dd>{offer?.status ?? status.label}</dd></div>
          <div>
            <dt>Angebotsnr.</dt>
            <dd>
              {lead.offerCode ? (
                <Link to={buildOfferPath(lead.offerCode)}>{lead.offerCode}</Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="sc-dossier__section">
        <h3>Dokumente</h3>
        <ul className="sc-dossier__docs">
          {documents.map((doc) => (
            <li key={doc.id}>
              <span>{DOCUMENT_SLOT_LABELS[doc.type] ?? doc.type}</span>
              <span className="sc-dossier__doc-file">{doc.fileName}</span>
              <span className="sc-dossier__doc-exp">{formatExpiryCountdown(doc.expiresAt)}</span>
            </li>
          ))}
        </ul>
        <Link to="/backend/documents" className="sc-dossier__doc-link">Dokumenten-Tresor öffnen</Link>
      </section>
    </div>
  );
}
