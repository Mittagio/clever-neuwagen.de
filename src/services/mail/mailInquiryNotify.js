/**
 * Kundenanfrage – Mail-Benachrichtigung nach Lead-Erstellung.
 */
import { sendCustomerInquiryMails } from './mailFlowService.js';

/**
 * @param {object} lead
 * @param {object} [dealerContext]
 * @returns {Promise<{ ok: boolean, results?: object, error?: string }>}
 */
export async function notifyCustomerInquirySubmitted(lead, dealerContext = {}) {
  if (!lead?.contact?.email && !dealerContext.dealerEmail) {
    return { ok: false, error: 'Keine E-Mail für Kunde oder Händler' };
  }
  return sendCustomerInquiryMails({ lead, dealerContext });
}
