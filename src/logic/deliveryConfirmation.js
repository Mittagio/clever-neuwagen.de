import { DELIVERY_REWARDS } from '../data/deliveryRewards.js';
import { buildVoucherAssignmentHistory } from './partnerAssignment.js';

const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DELIVERY_TOKEN_TTL_DAYS = 30;

export function generateDeliveryToken() {
  return Array.from({ length: 8 }, () =>
    TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)],
  ).join('');
}

export function buildDeliveryConfirmUrl(token) {
  if (typeof window !== 'undefined' && window.location?.origin?.includes('localhost')) {
    return `${window.location.origin}/auslieferung/${token}`;
  }
  return `https://clever-neuwagen.de/auslieferung/${token}`;
}

export function isDeliveryTokenExpired(dc) {
  if (!dc?.sentAt) return false;
  const sent = new Date(dc.sentAt).getTime();
  const ttl = DELIVERY_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - sent > ttl;
}

export function buildDeliveryEmailBody(lead, confirmUrl) {
  const name = lead.contact?.name?.trim() || 'Kunde';
  const vehicle = lead.vehicle?.label ?? 'Ihr Fahrzeug';
  return [
    `Hallo ${name},`,
    '',
    `Ihr ${vehicle} wurde als ausgeliefert markiert.`,
    '',
    'Haben Sie Ihr Fahrzeug erhalten?',
    '',
    `Ja: ${confirmUrl}?antwort=ja`,
    `Nein: ${confirmUrl}?antwort=nein`,
    '',
    'Vielen Dank',
    'Ihr Autohaus-Team',
  ].join('\n');
}

export function formatRewardSummary(rewards = DELIVERY_REWARDS) {
  return [
    `Provision: ${rewards.provision} €`,
    `Tankgutschein: ${rewards.fuelVoucher} €`,
    `Ladegutschein: ${rewards.chargingVoucher} €`,
  ].join(' · ');
}

export function buildConfirmedHistoryText(rewards = DELIVERY_REWARDS) {
  if (rewards?.options?.length || rewards?.vouchers?.length) {
    return buildVoucherAssignmentHistory(rewards);
  }
  return [
    'Auslieferung bestätigt (Kunde: Ja)',
    formatRewardSummary(rewards),
  ].join('\n');
}

export function buildDeclinedHistoryText() {
  return 'Kunde: Fahrzeug noch nicht erhalten (Nein)';
}

export function buildEmailSentHistoryText(email, url) {
  return `Auslieferungsbestätigung per E-Mail gesendet an ${email}\nLink: ${url}`;
}
