import { getMailTemplate } from './mailTemplateRegistry.js';

/**
 * Ersetzt {{variable}} Platzhalter im Text.
 * @param {string} text
 * @param {Record<string, string|number|null|undefined>} variables
 */
export function interpolateMailText(text, variables = {}) {
  if (!text) return '';
  return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value == null || value === '') return '–';
    return String(value);
  });
}

/**
 * @param {string} templateId
 * @param {Record<string, string|number|null|undefined>} variables
 */
export function renderMailTemplate(templateId, variables = {}) {
  const template = getMailTemplate(templateId);
  if (!template) {
    throw new Error(`Mail-Template nicht gefunden: ${templateId}`);
  }
  return {
    templateId: template.id,
    templateName: template.name,
    subject: interpolateMailText(template.subject, variables),
    body: interpolateMailText(template.body, variables),
    from: null,
  };
}
