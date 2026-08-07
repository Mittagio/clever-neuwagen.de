/**
 * Tool: get_customer_context – READ
 */
import { buildCleverCustomerContext } from '../cleverContextBuilder.js';

export const getCustomerContextToolDef = {
  name: 'get_customer_context',
  kind: 'read',
  description:
    'Liefert den aktuellen Kundenkontext (Interesse, Konditionen, Wissen, Angebote, Journey). Keine erfundenen Daten.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export function executeGetCustomerContext(runtime = {}) {
  const context = buildCleverCustomerContext(runtime.lead || {}, {
    workingContext: runtime.workingContext,
    currentOffer: runtime.currentOffer,
  });
  return {
    ok: true,
    context,
  };
}
