/**
 * Kundenkontext aus Mail, CRM und Kundenakte zusammenführen
 */
import { formatCustomerDisplayName } from './dealerAiParser.js';
import { splitCustomerName } from './dealerAiMailExtractor.js';

function pickFirst(...values) {
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * @param {object} options
 * @param {object} [options.parsedFields]
 * @param {object} [options.carryCustomer]
 * @param {object} [options.addVehicleContext]
 * @param {object} [options.lead]
 */
export function mergeConfigureCustomerContext({
  parsedFields = {},
  carryCustomer = null,
  addVehicleContext = null,
  lead = null,
}) {
  const crmContact = lead?.contact ?? carryCustomer?.contact ?? null;

  const name = formatCustomerDisplayName(
    pickFirst(crmContact?.name, parsedFields.customerName, addVehicleContext?.customerName),
  );
  const split = splitCustomerName(name ?? parsedFields.customerName);
  const phone = pickFirst(crmContact?.phone, parsedFields.customerPhone);
  const email = pickFirst(crmContact?.email, parsedFields.customerEmail);

  return {
    name,
    firstName: pickFirst(parsedFields.customerFirstName, split.firstName),
    lastName: pickFirst(parsedFields.customerLastName, split.lastName),
    salutation: parsedFields.customerSalutation ?? split.salutation ?? null,
    phone,
    email,
    hasContact: Boolean(name || phone || email),
    sources: {
      name: crmContact?.name ? 'crm' : parsedFields.customerName ? 'mail' : addVehicleContext?.customerName ? 'crm' : null,
      phone: crmContact?.phone ? 'crm' : parsedFields.customerPhone ? 'mail' : null,
      email: crmContact?.email ? 'crm' : parsedFields.customerEmail ? 'mail' : null,
    },
  };
}

/**
 * CRM/Mail-Kontakt in Parser-Felder für Angebotserstellung übernehmen
 */
export function applyCustomerContextToFields(fields = {}, customerContext = {}) {
  if (!customerContext?.hasContact && !customerContext?.firstName) return fields;
  const name = customerContext.name
    ?? [customerContext.firstName, customerContext.lastName].filter(Boolean).join(' ');
  return {
    ...fields,
    customerName: name ?? fields.customerName,
    customerFirstName: customerContext.firstName ?? fields.customerFirstName,
    customerLastName: customerContext.lastName ?? fields.customerLastName,
    customerSalutation: customerContext.salutation ?? fields.customerSalutation,
    customerPhone: customerContext.phone ?? fields.customerPhone,
    customerEmail: customerContext.email ?? fields.customerEmail,
    customerMailNote: fields.customerMailNote ?? customerContext.mailNote ?? null,
    interestedPartyName: fields.interestedPartyName ?? customerContext.interestedPartyName ?? null,
  };
}

export function customerContextFromDraft(draft = {}, fallback = {}) {
  const customer = draft.customer ?? {};
  const name = customer.name
    ?? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    ?? fallback.name
    ?? null;
  return {
    name,
    firstName: customer.firstName ?? fallback.firstName ?? null,
    lastName: customer.lastName ?? fallback.lastName ?? null,
    salutation: customer.salutation ?? fallback.salutation ?? null,
    phone: customer.phone ?? fallback.phone ?? null,
    email: customer.email ?? fallback.email ?? null,
    mailNote: customer.mailNote ?? fallback.mailNote ?? null,
    interestedPartyName: customer.interestedPartyName ?? fallback.interestedPartyName ?? null,
    hasContact: Boolean(name || customer.phone || customer.email),
  };
}
