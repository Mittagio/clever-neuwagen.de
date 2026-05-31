/**
 * Teilen-Funktion für Trendseiten (WhatsApp / Web Share / Clipboard)
 */

import { copyToClipboard } from '../logic/templateService.js';

export function buildTrendShareMessage(article, pageUrl) {
  const url = pageUrl ?? (typeof window !== 'undefined'
    ? `${window.location.origin}${article.url ?? `/trends/${article.slug}`}`
    : `https://www.clever-neuwagen.de/trends/${article.slug}`);

  return [
    '🚀 Trend bei Clever-Neuwagen',
    '',
    `🍴 ${article.title}`,
    article.metaDescription ? `\n${article.metaDescription}` : '',
    '',
    '📍 Aus echten Beratungen & Marktdaten',
    '',
    `👉 ${url}`,
  ].filter(Boolean).join('\n');
}

export async function shareTrendArticle(article) {
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}${article.url ?? `/trends/${article.slug}`}`
    : '';
  const text = buildTrendShareMessage(article, url);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: article.title,
        text: text.replace(`👉 ${url}`, '').trim(),
        url,
      });
      return { ok: true, method: 'share' };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { ok: false, method: 'cancelled' };
      }
    }
  }

  try {
    await copyToClipboard(text);
    return { ok: true, method: 'clipboard' };
  } catch {
    return { ok: false, method: 'failed' };
  }
}
