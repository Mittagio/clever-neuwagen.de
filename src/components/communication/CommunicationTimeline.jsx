import { groupHistoryByDay } from '../../logic/communicationService.js';
import { COMMUNICATION_CHANNELS } from '../../data/communicationTypes.js';
import './CommunicationComponents.css';

function channelIcon(entry) {
  if (entry.channel === 'offer') return '💬';
  if (entry.channel && COMMUNICATION_CHANNELS[entry.channel]) {
    return COMMUNICATION_CHANNELS[entry.channel].icon;
  }
  if (entry.type === 'offer' || entry.type === 'offer_dialog') return '📄';
  if (entry.eventId === 'documents_requested') return '📎';
  if (entry.eventId === 'document_uploaded') return '⬆️';
  if (entry.eventId === 'selbstauskunft_completed') return '📋';
  if (entry.type === 'status') return '🔄';
  return '•';
}

export default function CommunicationTimeline({ history = [], activeTab = 'messages' }) {
  const groups = groupHistoryByDay(history);

  const filtered = groups.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (activeTab === 'messages') {
        return item.channel === 'email'
          || item.channel === 'whatsapp'
          || item.channel === 'offer'
          || item.type === 'note'
          || item.type === 'offer_dialog';
      }
      if (activeTab === 'offers') return item.channel === 'offer' || item.type === 'offer';
      if (activeTab === 'documents') {
        return item.channel === 'document'
          || item.type === 'offer_dialog' && (
            item.eventId === 'documents_requested'
            || item.eventId === 'document_uploaded'
            || item.eventId === 'selbstauskunft_completed'
          );
      }
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  if (!filtered.length) {
    return (
      <p className="comm-timeline__empty">
        Noch kein Verlauf in dieser Ansicht.
      </p>
    );
  }

  return (
    <div className="comm-timeline">
      {filtered.map((group) => (
        <section key={group.date} className="comm-timeline__day">
          <h3 className="comm-timeline__date">{group.date}</h3>
          <ul className="comm-timeline__list">
            {group.items.map((entry) => (
              <li
                key={entry.id}
                className={`comm-timeline__item${entry.direction ? ` comm-timeline__item--${entry.direction}` : ''}`}
              >
                <span className="comm-timeline__icon" aria-hidden="true">
                  {channelIcon(entry)}
                </span>
                <div className="comm-timeline__body">
                  <p className="comm-timeline__text">{entry.text}</p>
                  {entry.direction && (
                    <p className="comm-timeline__direction">
                      {entry.direction === 'inbound' ? 'Kunde' : 'Verkäufer'}
                    </p>
                  )}
                  {entry.offerCode && (
                    <p className="comm-timeline__meta">Angebot {entry.offerCode}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
