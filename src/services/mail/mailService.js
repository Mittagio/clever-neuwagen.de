/**
 * Öffentliche Mail-API – zentraler Einstieg für App-Flows.
 */

export {
  sendTemplatedMail,
  sendViaOutbox,
  retryMail,
  listMailOutbox,
  countFailedMails,
  getMailOutboxStats,
  MAIL_TEMPLATE_IDS,
} from './mailOutboxService.js';

export {
  sendCustomerLoginCodeMail,
  sendCustomerOfferLinkMail,
  sendCustomerOfferLinkMailFromOffer,
  sendCustomerInquiryMails,
  applyOfferMailDelivery,
  applyPortfolioMailDelivery,
  MAIL_FLOW,
} from './mailFlowService.js';

export { renderMailTemplate, interpolateMailText } from './mailRenderer.js';
export { getMailTemplate, listMailTemplates } from './mailTemplateRegistry.js';
export { MAIL_FROM, MAIL_FROM_DISPLAY, isMailProductionReady } from './mailConfig.js';
