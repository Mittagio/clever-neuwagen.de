import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import { buildSellerHint } from '../../services/customerRegistry.js';

function MatchCard({
  match,
  isStrong,
  onAdopt,
  onOpen,
  showCreateNew,
  onCreateNew,
}) {
  const { profile, hints, summaryLine } = match;
  const name = formatCustomerDisplayName(profile.contact.name);
  const phone = profile.contact.phone?.trim();
  const email = profile.contact.email?.trim();
  const sellerHint = isStrong ? buildSellerHint(profile) : null;

  return (
    <article className={`dai-customer-match${isStrong ? ' dai-customer-match--strong' : ''}`}>
      <p className="dai-customer-match__name">{name}</p>
      {phone && <p className="dai-customer-match__line">{phone}</p>}
      {!phone && email && <p className="dai-customer-match__line">{email}</p>}
      {phone && email && <p className="dai-customer-match__line dai-customer-match__line--muted">{email}</p>}
      {sellerHint && (
        <p className="dai-customer-match__hint dai-customer-match__hint--seller">{sellerHint}</p>
      )}
      {!sellerHint && summaryLine && (
        <p className="dai-customer-match__hint">{summaryLine}</p>
      )}
      {!sellerHint && hints?.length > 0 && (
        <p className="dai-customer-match__hint">{hints.join(' · ')}</p>
      )}
      <div className="dai-customer-match__actions">
        <button
          type="button"
          className="dai-cta dai-cta--primary dai-cta--compact"
          onClick={() => onAdopt(match)}
        >
          {isStrong ? 'Kunde übernehmen' : 'Übernehmen'}
        </button>
        {onOpen && (
          <button
            type="button"
            className="dai-btn dai-btn--secondary dai-btn--compact"
            onClick={() => onOpen(profile.primaryLeadId)}
          >
            {isStrong ? 'Kundenakte öffnen' : 'Öffnen'}
          </button>
        )}
        {showCreateNew && isStrong && (
          <button
            type="button"
            className="dai-capture-skip dai-capture-skip--inline"
            onClick={onCreateNew}
          >
            Neu anlegen
          </button>
        )}
      </div>
    </article>
  );
}

export default function CustomerMatchSuggestions({
  title,
  matches = [],
  strongMatch = null,
  onAdopt,
  onOpen,
  onCreateNew,
}) {
  if (!matches.length) return null;

  const listTitle = title || 'Kunde gefunden';

  if (strongMatch) {
    return (
      <section className="dai-customer-matches dai-customer-matches--strong" aria-label="Bestehender Kunde">
        <p className="dai-customer-matches__title">{listTitle}</p>
        <MatchCard
          match={strongMatch}
          isStrong
          onAdopt={onAdopt}
          onOpen={onOpen}
          showCreateNew
          onCreateNew={onCreateNew}
        />
      </section>
    );
  }

  const hasMultipleStrong = matches.some((m) => m.score >= 100);

  return (
    <section
      className={`dai-customer-matches${hasMultipleStrong ? ' dai-customer-matches--strong' : ''}`}
      aria-label="Kundenvorschläge"
    >
      <p className="dai-customer-matches__title">{listTitle}</p>
      {!hasMultipleStrong && (
        <p className="dai-customer-matches__sub">Vielleicht ist er schon angelegt – einfach übernehmen.</p>
      )}
      <div className="dai-customer-matches__list">
        {matches.map((match) => (
          <MatchCard
            key={match.profile.customerId}
            match={match}
            isStrong={match.score >= 100}
            onAdopt={onAdopt}
            onOpen={onOpen}
            showCreateNew={hasMultipleStrong && match.score >= 100}
            onCreateNew={onCreateNew}
          />
        ))}
      </div>
      {onCreateNew && !strongMatch && (
        <button
          type="button"
          className="dai-capture-skip dai-capture-skip--block"
          onClick={onCreateNew}
        >
          Neu anlegen
        </button>
      )}
    </section>
  );
}
