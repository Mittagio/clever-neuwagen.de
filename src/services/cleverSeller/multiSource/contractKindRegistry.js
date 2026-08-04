/**
 * Erweiterbare Vertragsarten-Registry.
 * Neue Arten = Eintrag hier + optionaler Enricher – kein Core-Hardcode pro Modell.
 */

/**
 * @typedef {{
 *   id: string,
 *   documentKinds: string[],
 *   contractTypes: string[],
 *   label: string,
 *   aliases?: RegExp[],
 *   enrichExtracted?: (draft: object, text: string) => object,
 * }} ContractKindDefinition
 */

/** @type {ContractKindDefinition[]} */
export const CONTRACT_KIND_REGISTRY = [
  {
    id: 'leasing_standard',
    documentKinds: ['leasing_contract'],
    contractTypes: ['leasing'],
    label: 'Leasingvertrag',
    aliases: [/\bleasingvertrag\b/i, /\bkia\s+leasing\b/i],
  },
  {
    id: 'financing_standard',
    documentKinds: ['financing_contract'],
    contractTypes: ['financing'],
    label: 'Finanzierungsvertrag',
    aliases: [/\bfinanzierungsvertrag\b/i, /\bfinanzierung\b/i],
  },
  {
    id: 'financing_three_way',
    documentKinds: ['financing_contract'],
    contractTypes: ['financing', 'three_way_financing'],
    label: '3-Wege-Finanzierung',
    aliases: [
      /\b3[-\s]?wege[-\s]?finanz/i,
      /\bdrei[-\s]?wege[-\s]?finanz/i,
      /\bschlussrate\b/i,
      /\bfinal\s*payment\b/i,
      /\bballon\b/i,
    ],
    enrichExtracted(draft, text) {
      const t = String(text || '');
      const next = { ...draft, fields: { ...(draft.fields || {}) } };
      if (!next.fields.contractSubtype) {
        next.fields.contractSubtype = 'three_way_financing';
      }
      // Schlussrate / Schlusszahlung – nur wenn belegt
      if (next.fields.finalPayment == null) {
        const m = t.match(
          /\b(?:schlussrate|schlusszahlung|schlusszahlung\s*\/?\s*ballon|restwert)\s*[:=\s]*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+)\s*(?:€|euro)?/i,
        );
        if (m) {
          const n = parseDeMoney(m[1]);
          if (n != null) {
            next.fields.finalPayment = n;
            next.evidence = [
              ...(next.evidence || []),
              {
                field: 'finalPayment',
                value: n,
                evidenceText: m[0],
                confidence: 0.9,
                sourceType: 'contract_pdf',
              },
            ];
          }
        }
      }
      if (/\b3[-\s]?wege|drei[-\s]?wege|schlussrate/i.test(t)) {
        next.fields.contractTypeLabel = '3-Wege-Finanzierung';
      }
      return next;
    },
  },
  {
    id: 'purchase_standard',
    documentKinds: ['purchase_contract'],
    contractTypes: ['purchase'],
    label: 'Kaufvertrag',
    aliases: [/\bkaufvertrag\b/i, /\bbarkauf\b/i],
  },
  {
    id: 'unknown_contract',
    documentKinds: ['unknown_contract'],
    contractTypes: [],
    label: 'Vertragsdokument',
  },
];

/**
 * @param {{ documentKind?: string, contractType?: string, text?: string }} params
 * @returns {ContractKindDefinition}
 */
export function resolveContractKind(params = {}) {
  const text = String(params.text || '');
  const docKind = params.documentKind || null;
  const contractType = params.contractType || null;

  // Spezifischere Aliases zuerst (3-Wege vor generic financing)
  const ranked = [...CONTRACT_KIND_REGISTRY].sort((a, b) => {
    const score = (k) => (k.id.includes('three_way') ? 2 : k.id === 'unknown_contract' ? -1 : 1);
    return score(b) - score(a);
  });

  for (const kind of ranked) {
    if (kind.id === 'unknown_contract') continue;
    if (kind.aliases?.some((re) => re.test(text))) return kind;
  }

  for (const kind of ranked) {
    if (kind.id === 'unknown_contract') continue;
    if (docKind && kind.documentKinds.includes(docKind)) return kind;
    if (contractType && kind.contractTypes.includes(contractType)) return kind;
  }

  return CONTRACT_KIND_REGISTRY.find((k) => k.id === 'unknown_contract');
}

/**
 * @param {object} draft – extractCustomerContractFromText result shape
 * @param {string} text
 */
export function enrichContractDraftByKind(draft = {}, text = '') {
  const fields = draft.fields || draft;
  const documentKind = draft.documentClassification
    || (fields.contractType === 'leasing' ? 'leasing_contract'
      : fields.contractType === 'financing' ? 'financing_contract'
        : fields.contractType === 'purchase' ? 'purchase_contract'
          : 'unknown_contract');
  const kind = resolveContractKind({
    documentKind,
    contractType: fields.contractType,
    text,
  });
  const base = {
    ...draft,
    fields: { ...fields },
    evidence: [...(draft.evidence || [])],
    contractKindId: kind.id,
    contractKindLabel: kind.label,
  };
  return typeof kind.enrichExtracted === 'function'
    ? kind.enrichExtracted(base, text)
    : base;
}

function parseDeMoney(raw) {
  let s = String(raw || '').trim().replace(/\s/g, '');
  if (!s) return null;
  if (/\.\d{3}/.test(s) && /,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}(?:\D|$)/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
