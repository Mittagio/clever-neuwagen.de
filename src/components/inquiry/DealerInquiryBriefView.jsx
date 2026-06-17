import './DealerInquiryBriefView.css';



export default function DealerInquiryBriefView({ brief, showDealerNote = true }) {

  if (!brief) return null;



  const snapshot = brief.cleverQuoteSnapshot;



  return (

    <div className="dealer-inq-brief" aria-label="Anfrage-Zusammenfassung für Händler">

      {showDealerNote && (

        <p className="dealer-inq-brief__note">

          Der Händler erhält diese strukturierte Zusammenfassung – nicht nur „Interesse an Fahrzeug“.

        </p>

      )}



      {brief.customerName && (

        <p className="dealer-inq-brief__customer">{brief.customerName}</p>

      )}



      {brief.cleverQuotePercent != null && (

        <p className="dealer-inq-brief__cq">

          <strong>{brief.cleverQuotePercent} %</strong> CleverQuote

        </p>

      )}



      {brief.budget && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Budget</p>

          <p>{brief.budget.label}</p>

        </div>

      )}



      {(brief.wishes?.fulfilled?.length > 0 || brief.wishes?.optional?.length > 0 || brief.wishes?.selected?.length > 0) && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Wünsche</p>

          <ul className="dealer-inq-brief__list">

            {brief.wishes.fulfilled.map((w) => (

              <li key={w}><span aria-hidden>✓</span> {w}</li>

            ))}

            {brief.wishes.optional.map((w) => (

              <li key={w} className="dealer-inq-brief__optional"><span aria-hidden>+</span> {w} (Paket)</li>

            ))}

          </ul>

          {brief.wishes.selected?.length > 0 && (

            <p className="dealer-inq-brief__sub">Gewählt: {brief.wishes.selected.join(', ')}</p>

          )}

        </div>

      )}



      {snapshot?.missing?.length > 0 && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Nicht erfüllt</p>

          <ul className="dealer-inq-brief__list dealer-inq-brief__list--missing">

            {snapshot.missing.map((i) => (

              <li key={i.id}><span aria-hidden>✗</span> {i.label}</li>

            ))}

          </ul>

        </div>

      )}



      {snapshot?.uncertain?.length > 0 && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Derzeit nicht sicher verfügbar</p>

          <ul className="dealer-inq-brief__list dealer-inq-brief__list--uncertain">

            {snapshot.uncertain.map((i) => (

              <li key={i.id}><span aria-hidden>?</span> {i.label}</li>

            ))}

          </ul>

        </div>

      )}



      {brief.recommended?.title && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Empfohlen</p>

          <p className="dealer-inq-brief__highlight">{brief.recommended.title}</p>

        </div>

      )}



      {brief.packageRecommendation && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Paket</p>

          <p>{brief.packageRecommendation}</p>

        </div>

      )}



      {brief.alternatives?.length > 0 && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Alternativen</p>

          <ul className="dealer-inq-brief__alt-list">

            {brief.alternatives.map((alt) => (

              <li key={alt.slug ?? alt.title}>

                {alt.title}

                {alt.cleverQuotePercent != null && (

                  <span className="dealer-inq-brief__alt-pct"> ({alt.cleverQuotePercent} %)</span>

                )}

                {alt.priceLabel && (

                  <span className="dealer-inq-brief__alt-price"> · {alt.priceLabel}</span>

                )}

              </li>

            ))}

          </ul>

        </div>

      )}



      {(brief.variant?.lines?.length > 0 || brief.variant?.priceLabel) && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Gewählte Zahlungsart</p>

          <ul className="dealer-inq-brief__list dealer-inq-brief__list--plain">

            {brief.variant.lines.map((line) => (

              <li key={line}>{line}</li>

            ))}

          </ul>

          {brief.variant.priceLabel && (

            <p className="dealer-inq-brief__price">{brief.variant.priceLabel}</p>

          )}

        </div>

      )}



      {brief.dealer?.name && (

        <div className="dealer-inq-brief__block">

          <p className="dealer-inq-brief__label">Händler</p>

          <p>

            {brief.dealer.name}

            {brief.dealer.distanceKm != null && ` · ${brief.dealer.distanceKm} km`}

          </p>

        </div>

      )}



      {brief.deliveryLabel && (

        <p className="dealer-inq-brief__delivery">

          {brief.deliveryImportant ? '🕒 ' : ''}{brief.deliveryLabel}

        </p>

      )}



      {snapshot?.percent != null && (

        <p className="dealer-inq-brief__explain">

          CleverQuote: {snapshot.matched} Wünsche erfüllt

          {snapshot.scorableTotal ? ` von ${snapshot.scorableTotal} prüfbaren` : ''}.

        </p>

      )}

    </div>

  );

}


