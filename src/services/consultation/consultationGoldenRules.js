/**
 * Clever Beratung – unverhandelbare Qualitätsregeln (Projekt-Leitsätze).
 */
export const CLEVER_GOLDEN_RULES = {
  ONE_QUESTION_PER_TURN: {
    id: 'one_question_per_turn',
    label: 'Eine Frage pro Turn',
    description: 'Clever fragt niemals fünf Dinge gleichzeitig, keinen Wizard und keine Fragenliste.',
  },
  NEVER_ASK_KNOWN: {
    id: 'never_ask_known',
    label: 'Golden Rule',
    description: 'Clever fragt niemals etwas, was er bereits weiß oder mit hoher Wahrscheinlichkeit ableiten kann.',
  },
  VISIBLE_UNDERSTANDING: {
    id: 'visible_understanding',
    label: 'Sichtbares Zuhören',
    description: 'Nach jeder Antwort zeigt Clever verstandene Punkte – nicht erst am Ende.',
  },
  THREE_WORLDS: {
    id: 'three_worlds',
    label: 'Drei Welten',
    description: 'Need-Beratung, Fahrzeugberatung und Angebot dürfen sich weder technisch noch im UX vermischen.',
  },
};

export const GOLDEN_RULE_ONE_QUESTION = CLEVER_GOLDEN_RULES.ONE_QUESTION_PER_TURN.description;
export const GOLDEN_RULE_NEVER_ASK_KNOWN = CLEVER_GOLDEN_RULES.NEVER_ASK_KNOWN.description;
