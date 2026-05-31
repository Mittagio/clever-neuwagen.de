import { DELIVERY_REWARDS } from '../data/deliveryRewards.js';
import { DRIVE_TYPES } from '../data/voucherPartners.js';

export function inferDriveType(lead) {
  const text = [
    lead.vehicle?.engine,
    lead.vehicle?.label,
    lead.vehicle?.model,
  ].filter(Boolean).join(' ').toLowerCase();

  if (
    text.includes('elektro')
    || text.includes(' ev')
    || text.includes('ev3')
    || text.includes('ev4')
    || text.includes('ev5')
    || text.includes('ev6')
    || text.includes('ev9')
  ) {
    return 'elektro';
  }
  if (
    text.includes('hybrid')
    || text.includes('phev')
    || text.includes('plug-in')
    || text.includes('mhev')
  ) {
    return 'hybrid';
  }
  return 'verbrenner';
}

function toVoucher(partner) {
  return {
    partnerId: partner.id,
    name: partner.name,
    type: partner.type,
    voucherValue: partner.voucherValue,
    validityLabel: partner.validityLabel,
    validityDays: partner.validityDays,
    promoCode: partner.promoCode,
  };
}

/** Alle aktiven Partner als wählbare Geschenk-Optionen bereitstellen */
export function buildGiftOptionsForLead(lead, partners) {
  const driveType = inferDriveType(lead);
  const options = partners
    .filter((p) => p.active)
    .map(toVoucher);

  return {
    driveType,
    driveTypeLabel: DRIVE_TYPES[driveType]?.label ?? driveType,
    provision: DELIVERY_REWARDS.provision,
    options,
    selectedPartnerId: null,
    vouchers: [],
    fuelVoucher: DELIVERY_REWARDS.fuelVoucher,
    chargingVoucher: DELIVERY_REWARDS.chargingVoucher,
  };
}

/** @deprecated Alias – nutzt buildGiftOptionsForLead */
export function assignVouchersForLead(lead, partners) {
  return buildGiftOptionsForLead(lead, partners);
}

export function applyVoucherSelection(rewards, partnerId, partners) {
  const partner = partners.find((p) => p.id === partnerId);
  if (!partner) return rewards;
  const voucher = toVoucher(partner);
  return {
    ...rewards,
    selectedPartnerId: partnerId,
    vouchers: [voucher],
  };
}

export function getSelectedVoucher(rewards) {
  return rewards?.vouchers?.[0] ?? null;
}

export function buildVoucherAssignmentHistory(assignment) {
  const lines = [
    'Auslieferung bestätigt (Kunde: Ja)',
    `Antriebsart: ${assignment.driveTypeLabel}`,
    `Provision: ${assignment.provision} €`,
  ];

  const selected = getSelectedVoucher(assignment);
  if (selected) {
    const kind = selected.type === 'fuel' ? 'Tankgutschein' : 'Ladegutschein';
    lines.push(`${kind} gewählt: ${selected.name} · ${selected.voucherValue} € · Code ${selected.promoCode}`);
  } else {
    const count = assignment.options?.length ?? 0;
    lines.push(`Gutschein: Kunde wählt noch (${count} Optionen verfügbar)`);
  }

  return lines.join('\n');
}

export function buildVoucherSelectedHistory(rewards) {
  const selected = getSelectedVoucher(rewards);
  if (!selected) return 'Gutschein-Auswahl fehlgeschlagen';
  const kind = selected.type === 'fuel' ? 'Tankgutschein' : 'Ladegutschein';
  return [
    `Gutschein gewählt (Kunde)`,
    `${kind}: ${selected.name}`,
    `${selected.voucherValue} € · Code ${selected.promoCode} · ${selected.validityLabel}`,
  ].join('\n');
}

export function formatVoucherSummary(rewards) {
  const selected = getSelectedVoucher(rewards);
  if (selected) return `${selected.name} (${selected.promoCode})`;
  const count = rewards?.options?.length ?? rewards?.vouchers?.length ?? 0;
  if (count) return `${count} Optionen · Auswahl ausstehend`;
  return '';
}
