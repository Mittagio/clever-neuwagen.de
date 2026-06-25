import { useMemo } from 'react';
import { buildOfferMailtoHref, buildOfferWhatsappHref } from '../../services/vehicleOffer.js';
import { buildCleverAntwortEmailSubject } from '../../services/cleverAntworten.js';
import {
  buildQuestionReplyDraft,
  formatTimelinePresentation,
} from '../../services/customerActivityTimeline.js';
import { sortHistoryNewestFirst } from '../../services/customerAkteHistory.js';
import { polishHistoryText } from '../../services/cleverSalesCoach.js';
import './CustomerAkte.css';

function ActivityTimelineItem({
  item,
  phone,
  email,
  customerName,
  onPersonalReply,
}) {
  const replyDraft = useMemo(() => {
    if (!item.isQuestion || !item.cleverAnswer) return '';
    return buildQuestionReplyDraft(item.entry.question, item.cleverAnswer, customerName);
  }, [item, customerName]);

  const whatsappHref = replyDraft && phone?.trim()
    ? buildOfferWhatsappHref(phone, replyDraft)
    : null;
  const mailtoHref = replyDraft && email?.trim()
    ? buildOfferMailtoHref(email, buildCleverAntwortEmailSubject({ customerName }), replyDraft)
    : null;

  return (
    <li className={`cust-akte-timeline__item${item.isQuestion ? ' is-question' : ''}`}>
      <div className="cust-akte-timeline__head">
        <span className="cust-akte-timeline__time">{item.time}</span>
        <span className="cust-akte-timeline__icon" aria-hidden="true">{item.icon}</span>
        <span className="cust-akte-timeline__headline">{polishHistoryText(item.headline)}</span>
      </div>

      {item.body && (
        <p className="cust-akte-timeline__body">{item.body}</p>
      )}

      {item.isQuestion && item.cleverAnswer && (
        <details className="cust-akte-timeline__answer">
          <summary>Clever-Antwort anzeigen</summary>
          <p>{item.cleverAnswer}</p>
        </details>
      )}

      {item.isQuestion && (
        <div className="cust-akte-timeline__actions">
          {item.cleverAnswer && (
            <button type="button" className="dai-btn dai-btn--ghost dai-btn--sm" onClick={() => onPersonalReply?.(item)}>
              Persönlich übernehmen
            </button>
          )}
          {whatsappHref && (
            <a href={whatsappHref} className="dai-btn dai-btn--secondary dai-btn--sm" target="_blank" rel="noopener noreferrer">
              WhatsApp erstellen
            </a>
          )}
          {mailtoHref && (
            <a href={mailtoHref} className="dai-btn dai-btn--secondary dai-btn--sm">
              E-Mail erstellen
            </a>
          )}
        </div>
      )}
    </li>
  );
}

export default function CustomerAkteActivityTimeline({
  history = [],
  dashboard = null,
  phone = '',
  email = '',
  customerName = '',
  onPersonalReply,
}) {
  const items = useMemo(() => (
    sortHistoryNewestFirst(history).map((entry) => formatTimelinePresentation(entry))
  ), [history]);

  return (
    <div className="cust-akte-timeline">
      {dashboard && (
        <div className="cust-akte-timeline__stats">
          <p className="cust-akte-timeline__stats-total">
            {dashboard.total}
            {' '}
            {dashboard.total === 1 ? 'Aktivität' : 'Aktivitäten'}
          </p>
          {(dashboard.newCustomerActivities > 0 || dashboard.newQuestions > 0 || dashboard.newFavorites > 0) && (
            <ul className="cust-akte-timeline__stats-breakdown">
              {dashboard.newCustomerActivities > 0 && (
                <li>
                  {dashboard.newCustomerActivities}
                  {' '}
                  neue Kundenaktivität{dashboard.newCustomerActivities === 1 ? '' : 'en'}
                </li>
              )}
              {dashboard.newQuestions > 0 && (
                <li>
                  {dashboard.newQuestions}
                  {' '}
                  neue Frage{dashboard.newQuestions === 1 ? '' : 'n'}
                </li>
              )}
              {dashboard.newFavorites > 0 && (
                <li>
                  {dashboard.newFavorites}
                  {' '}
                  Favorit{dashboard.newFavorites === 1 ? '' : 'e'} erkannt
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="dai-lead-empty">Noch keine Aktivitäten.</p>
      ) : (
        <ul className="cust-akte-timeline__list dai-lead-history dai-lead-history--timeline">
          {items.map((item) => (
            <ActivityTimelineItem
              key={item.id}
              item={item}
              phone={phone}
              email={email}
              customerName={customerName}
              onPersonalReply={onPersonalReply}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
