/** Verkaufscoach – Motivation, Microcopy & positive Formulierungen */

export function getCleverStaerkeMotivationHints({
  name = '',
  phone = '',
  email = '',
  reservedModelsCount = 0,
  offersCount = 0,
  hasNextStep = true,
}) {
  const hints = [];
  if (!name?.trim() || name.trim() === 'Kunde (offen)') {
    hints.push('Mit Namen wirkt die Chance persönlicher.');
  }
  if (!phone?.trim()) {
    hints.push('Telefon ergänzt? Dann ist der Rückruf nur ein Klick.');
  }
  if (!email?.trim()) {
    hints.push('Mit E-Mail ist das Angebot später in Sekunden raus.');
  }
  if (reservedModelsCount === 0) {
    hints.push('Ein passendes Modell bringt die Chance in Fahrt.');
  }
  if (!hasNextStep) {
    hints.push('Ein nächster Schritt hält die Chance warm.');
  }
  if (offersCount === 0) {
    hints.push('Ein Angebot macht aus Interesse eine echte Option.');
  }
  return hints;
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function getFollowUpCoachCard({
  nextStepId = '',
  pipelineStatusId = 'neu',
  offers = [],
  followUpAt = null,
}) {
  const primaryOffer = offers[0];
  const offerStatus = primaryOffer?.status;
  const followUpToday = isToday(followUpAt) || nextStepId === 'call_today';

  if (offerStatus === 'accepted') {
    return {
      title: 'Stark. Abschluss in Sicht.',
      text: 'Jetzt die nächsten Schritte vorbereiten.',
      cta: 'Abschluss vorbereiten',
      ctaAction: 'prepare_close',
      tone: 'success',
    };
  }

  if (offerStatus === 'opened') {
    return {
      title: 'Jetzt ist ein guter Moment',
      text: 'Der Kunde hat reingeschaut. Guter Moment für einen kurzen Anruf.',
      cta: 'Jetzt anrufen',
      ctaAction: 'call',
      tone: 'hot',
    };
  }

  if (offerStatus === 'sent' || pipelineStatusId === 'angebot_gesendet') {
    return {
      title: 'Heute heiß 🔥',
      text: 'Angebot ist raus. Ein kurzer Anruf kann jetzt den Abschluss bringen.',
      cta: 'Jetzt anrufen',
      ctaAction: 'call',
      tone: 'hot',
    };
  }

  if (followUpToday) {
    return {
      title: 'Heute heiß 🔥',
      text: 'Jetzt ist ein guter Moment für einen kurzen Kontakt.',
      cta: 'Jetzt anrufen',
      ctaAction: 'call',
      tone: 'hot',
    };
  }

  if (nextStepId === 'send_offer') {
    return {
      title: 'Angebot wartet',
      text: 'Ein kurzer Kontakt macht den nächsten Schritt leicht.',
      cta: 'Link senden',
      ctaAction: 'send_offer',
      tone: 'warm',
    };
  }

  if (pipelineStatusId === 'nachfassen' || nextStepId === 'reminder') {
    return {
      title: 'Dranbleiben',
      text: 'Der Kunde hat Interesse gezeigt. Heute kurz nachfassen.',
      cta: 'Anrufen',
      ctaAction: 'call',
      tone: 'warm',
    };
  }

  return {
    title: 'Chance warm halten',
    text: 'Ein kurzer Kontakt hält den Ball im Spiel.',
    cta: 'Nachfassen',
    ctaAction: 'followup',
    tone: 'neutral',
  };
}

export function getOfferMicroFeedback(offerStatus = 'draft') {
  switch (offerStatus) {
    case 'sent':
      return {
        headline: 'Angebot ist beim Kunden.',
        subline: 'Morgen kurz nachfassen und warm halten.',
        cta: 'Nachfassen planen',
      };
    case 'opened':
      return {
        headline: 'Der Kunde hat reingeschaut.',
        subline: 'Guter Moment für einen kurzen Anruf.',
        cta: 'Jetzt anrufen',
      };
    case 'accepted':
      return {
        headline: 'Stark. Abschluss in Sicht.',
        subline: 'Jetzt die nächsten Schritte vorbereiten.',
        cta: 'Abschluss vorbereiten',
      };
    case 'draft':
    default:
      return {
        headline: 'Angebot steht.',
        subline: 'Jetzt nur noch raus damit.',
        cta: 'Link senden',
      };
  }
}

const DAILY_HEADLINES = [
  'Heute liegen Chancen bereit.',
  'Dein Verkaufs-Momentum sieht gut aus.',
  'Ein kurzer Rückruf kann heute den Unterschied machen.',
];

export function getDailyMotivation({
  dueTodayCount = 0,
  hotOffers = 0,
  newLeads = 0,
} = {}) {
  if (dueTodayCount > 0) {
    return {
      headline: `${dueTodayCount} Chance${dueTodayCount !== 1 ? 'n' : ''} warten auf deinen Anruf.`,
      subline: 'Ein kurzer Rückruf kann heute den Unterschied machen.',
    };
  }
  if (hotOffers >= 2) {
    return {
      headline: `Heute sind ${hotOffers} Angebote heiß.`,
      subline: 'Jetzt nachfassen und warm halten.',
    };
  }
  if (newLeads > 0) {
    return {
      headline: `${newLeads} neue Chance${newLeads !== 1 ? 'n' : ''} – guter Start in den Tag.`,
      subline: 'Ein kurzer Rückruf kann heute den Unterschied machen.',
    };
  }
  return {
    headline: DAILY_HEADLINES[0],
    subline: 'Ein kurzer Rückruf kann heute den Unterschied machen.',
  };
}

export function getDailyGoalProgress({
  callbacksDone = 0,
  callbacksGoal = 3,
  offersSentToday = 0,
} = {}) {
  const remaining = Math.max(0, callbacksGoal - callbacksDone);
  const pct = Math.min(100, Math.round((callbacksDone / callbacksGoal) * 100));

  let label;
  if (callbacksDone >= callbacksGoal) {
    label = 'Tagesziel erreicht – stark im Flow.';
  } else if (remaining === 1) {
    label = 'Noch 1 Kontakt und dein Tagesziel ist rund.';
  } else {
    label = `Noch ${remaining} Kontakte und dein Tagesziel ist rund.`;
  }

  return {
    label,
    progress: `${callbacksDone} von ${callbacksGoal} Rückrufen`,
    offersSentToday,
    pct,
  };
}

export function computeDailyCoachFromLeads(leads = [], dueToday = []) {
  const today = new Date().toDateString();
  let callbacksDone = 0;

  for (const lead of leads) {
    for (const entry of lead.history ?? []) {
      if (!entry.at) continue;
      const d = new Date(entry.at);
      if (d.toDateString() !== today) continue;
      const text = (entry.text ?? '').toLowerCase();
      if (/angerufen|anruf|rückruf|kontakt|nachfass/.test(text)) {
        callbacksDone += 1;
      }
    }
  }

  const callbacksGoal = Math.max(3, dueToday.length + callbacksDone);

  return {
    callbacksDone,
    callbacksGoal,
  };
}

const HISTORY_PHRASE_MAP = {
  'kunde gespeichert': 'Kundendaten ergänzt',
  'wunsch gespeichert': 'Kundenwunsch festgehalten',
  'verkaufschance gespeichert': 'Chance aktualisiert',
  'verkaufschance angelegt': 'Kundenwunsch erfasst',
  'gespeichert': 'Chance aktualisiert',
  'wiedervorlage': 'Nachfassen geplant',
};

export function polishHistoryText(text = '') {
  const lower = text.trim().toLowerCase();
  for (const [key, value] of Object.entries(HISTORY_PHRASE_MAP)) {
    if (lower === key || lower.startsWith(key)) {
      return text.replace(new RegExp(key, 'i'), value);
    }
  }
  if (/nachfassen geplant/i.test(text)) return text;
  if (/wiedervorlage/i.test(text)) {
    return text.replace(/wiedervorlage/gi, 'Nachfassen');
  }
  return text;
}
