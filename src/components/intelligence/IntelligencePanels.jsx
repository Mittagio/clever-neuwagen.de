import { Link } from 'react-router-dom';
import {
  SectionCard,
  RankingBars,
  KpiStrip,
  CleverScoreBadge,
  DataTable,
} from './IntelligenceShared.jsx';

export function OverviewPanel({ overview, bestDeals }) {
  const { kpis, topSearch, topRecommendation, topComparison } = overview;

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Suchanfragen', value: kpis.searches, accent: 'blue' },
          { label: 'KI-Empfehlungen', value: kpis.advisorSessions, accent: 'purple' },
          { label: 'Vergleiche', value: kpis.comparisons, accent: 'teal' },
          { label: 'Angebote', value: kpis.offersCreated, accent: 'green' },
          { label: 'Abschlüsse', value: kpis.salesClosed, accent: 'mint' },
        ]}
      />

      <div className="intel-grid intel-grid--3">
        <SectionCard title="Top-Suche" subtitle={topSearch?.query}>
          <p className="intel-highlight">{topSearch?.count ?? '–'} Anfragen</p>
        </SectionCard>
        <SectionCard title="Top-Empfehlung" subtitle={topRecommendation?.label}>
          <p className="intel-highlight">{topRecommendation?.recommended ?? '–'}× empfohlen</p>
        </SectionCard>
        <SectionCard title="Top-Vergleich" subtitle={topComparison?.pair}>
          <p className="intel-highlight">{topComparison?.count ?? '–'}× verglichen</p>
        </SectionCard>
      </div>

      {bestDeals[0] && (
        <SectionCard title="Best Deal der Woche" subtitle="Clever Score">
          <article className="intel-deal">
            <div className="intel-deal__main">
              <span className="intel-deal__fire" aria-hidden>🔥</span>
              <div>
                <h3 className="intel-deal__title">{bestDeals[0].label}</h3>
                <p className="intel-deal__meta">
                  ab {bestDeals[0].rate} € · {bestDeals[0].deliveryWeeks} Wo. Lieferzeit · {bestDeals[0].discount}% Rabatt
                </p>
                <p className="intel-deal__equip">{bestDeals[0].equipmentHighlight}</p>
              </div>
            </div>
            <CleverScoreBadge score={bestDeals[0].cleverScore} size="lg" />
          </article>
        </SectionCard>
      )}
    </>
  );
}

export function SearchPanel({ search, equipmentDemand }) {
  return (
    <>
      <SectionCard title="Top Suchanfragen" subtitle="Was Kunden suchen">
        <RankingBars items={search} labelKey="query" />
      </SectionCard>
      <SectionCard title="Gefragte Ausstattungen" subtitle="Aus Beratungen & Konfigurationen">
        <RankingBars items={equipmentDemand} labelKey="feature" />
      </SectionCard>
    </>
  );
}

export function RecommendationsPanel({ recommendations }) {
  const columns = [
    { key: 'label', label: 'Fahrzeug' },
    { key: 'recommended', label: 'Empfehlungen' },
    { key: 'offerRequests', label: 'Angebotsanfragen' },
    { key: 'closed', label: 'Abschlüsse' },
    {
      key: 'conversionRate',
      label: 'Conversion',
      render: (row) => `${row.conversionRate}%`,
    },
  ];

  const rows = recommendations.map((row, i) => ({ ...row, id: row.vehicleId, rank: i + 1 }));

  return (
    <SectionCard title="KI-Beratung" subtitle="Welche Empfehlungen werden erzeugt?">
      <DataTable columns={[{ key: 'rank', label: '#' }, ...columns]} rows={rows} />
    </SectionCard>
  );
}

export function ComparisonsPanel({ comparisons }) {
  return (
    <SectionCard title="Fahrzeug-Vergleiche" subtitle="Häufigste Paarungen">
      <RankingBars items={comparisons} labelKey="pair" />
    </SectionCard>
  );
}

export function OffersPanel({ offers }) {
  return (
    <>
      <KpiStrip
        items={[
          { label: 'Erstellt', value: offers.created, accent: 'blue' },
          { label: 'Versendet', value: offers.sent, accent: 'purple' },
          { label: 'Geöffnet', value: offers.viewed, accent: 'teal' },
          { label: 'Angenommen', value: offers.accepted, accent: 'green' },
        ]}
      />
      <SectionCard title="Angebots-Annahme" subtitle={`${offers.acceptanceRate}% Annahmerate`}>
        <RankingBars items={offers.topModels} labelKey="label" />
      </SectionCard>
    </>
  );
}

export function SalesPanel({ sales }) {
  const revenueFormatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(sales.revenue);

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Abschlüsse', value: sales.closed, accent: 'green' },
          { label: 'Pipeline', value: sales.pipeline, accent: 'purple' },
          { label: 'Umsatz', value: revenueFormatted, accent: 'blue' },
          { label: 'Ø Tage bis Abschluss', value: sales.avgDaysToClose, accent: 'teal' },
        ]}
      />
      <SectionCard title="Verkaufte Modelle">
        <DataTable
          columns={[
            { key: 'label', label: 'Modell' },
            { key: 'count', label: 'Abschlüsse' },
            { key: 'avgRate', label: 'Ø Rate', render: (r) => `${r.avgRate} €` },
          ]}
          rows={sales.topModels}
        />
      </SectionCard>
    </>
  );
}

export function TrendsPanel({
  leasing,
  familyIndex,
  electroIndex,
  delivery,
  bestDeals,
  trendPages,
  scoreWeights,
  onPublishTrend,
  onUnpublishTrend,
}) {
  const canManage = (page) => page.source === 'intelligence';

  return (
    <>
      <div className="intel-grid intel-grid--2">
        <SectionCard title="Leasing-Trends" subtitle="Beliebteste Wunschraten">
          <RankingBars items={leasing.desiredRates} labelKey="label" maxItems={5} />
        </SectionCard>
        <SectionCard title="Laufzeiten & Kilometer">
          <RankingBars items={leasing.terms} labelKey="label" maxItems={4} />
          <div className="intel-spacer" />
          <RankingBars items={leasing.mileages} labelKey="label" maxItems={4} />
        </SectionCard>
      </div>

      <div className="intel-grid intel-grid--2">
        <SectionCard title="Familienindex" subtitle="Top 10 · aus Beratungen, Angeboten & Vergleichen">
          <DataTable
            columns={[
              { key: 'rank', label: '#' },
              { key: 'label', label: 'Fahrzeug' },
              { key: 'rate', label: 'Rate', render: (r) => `${r.rate} €` },
              { key: 'deliveryWeeks', label: 'Lieferzeit', render: (r) => `${r.deliveryWeeks} Wo.` },
              { key: 'cleverScore', label: 'Score', render: (r) => `${r.cleverScore}/100` },
            ]}
            rows={familyIndex}
          />
        </SectionCard>

        <SectionCard title="Elektroindex" subtitle="Top 10 · Nachfrage & Reichweite">
          <DataTable
            columns={[
              { key: 'rank', label: '#' },
              { key: 'label', label: 'Fahrzeug' },
              { key: 'rangeKm', label: 'Reichweite', render: (r) => `${r.rangeKm} km` },
              { key: 'rate', label: 'Rate', render: (r) => `${r.rate} €` },
              { key: 'demand', label: 'Nachfrage', render: (r) => `${r.demand}%` },
            ]}
            rows={electroIndex}
          />
        </SectionCard>
      </div>

      <SectionCard title="Lieferzeit-Monitor" subtitle="Pro Modell · aus Beratungen & Angeboten">
        <div className="intel-grid intel-grid--2">
          <div>
            <h3 className="intel-subhead">Kürzeste Lieferzeiten</h3>
            <DataTable
              columns={[
                { key: 'model', label: 'Modell' },
                { key: 'minWeeks', label: 'Min.', render: (r) => `${r.minWeeks} Wo.` },
                { key: 'avgWeeks', label: 'Ø', render: (r) => `${r.avgWeeks} Wo.` },
              ]}
              rows={delivery.fastest}
            />
          </div>
          <div>
            <h3 className="intel-subhead">Längste Lieferzeiten</h3>
            <DataTable
              columns={[
                { key: 'model', label: 'Modell' },
                { key: 'maxWeeks', label: 'Max.', render: (r) => `${r.maxWeeks} Wo.` },
                { key: 'avgWeeks', label: 'Ø', render: (r) => `${r.avgWeeks} Wo.` },
              ]}
              rows={delivery.slowest}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Best Deals der Woche" subtitle="Score aus Rabatt, Rate, Lieferzeit, Ausstattung">
        <div className="intel-deals-grid">
          {bestDeals.map((deal) => (
            <article key={deal.vehicleId} className="intel-deal intel-deal--compact">
              <div className="intel-deal__main">
                <span className="intel-deal__fire" aria-hidden>🔥</span>
                <div>
                  <h3 className="intel-deal__title">{deal.label}</h3>
                  <p className="intel-deal__meta">
                    {deal.rate} € · {deal.deliveryWeeks} Wo.
                    {deal.discount > 0 && ` · −${deal.discount}%`}
                  </p>
                  {deal.equipmentHighlight && (
                    <p className="intel-deal__equip">{deal.equipmentHighlight}</p>
                  )}
                </div>
              </div>
              <CleverScoreBadge score={deal.cleverScore} />
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Trendseiten" subtitle="Vorschläge veröffentlichen → erscheinen unter /trends">
        <ul className="intel-trend-list">
          {trendPages.map((page) => {
            const trendUrl = page.url?.startsWith('/ratgeber')
              ? page.url
              : `/trends/${page.slug}`;
            const isPublished = page.status === 'published' && page.source === 'intelligence';
            const showPublish = canManage(page) && (page.status === 'draft' || page.status === 'suggested');
            const showUnpublish = canManage(page) && isPublished;

            return (
            <li key={page.slug} className="intel-trend-item">
              <div className="intel-trend-item__body">
                <Link to={trendUrl} className="intel-trend-item__title intel-trend-item__link">
                  {page.title}
                </Link>
                <p className="intel-trend-item__meta">
                  {page.category}
                  {page.status === 'published' && page.source === 'ratgeber' && ' · Ratgeber'}
                  {page.status === 'published' && page.source === 'intelligence' && ' · Live unter /trends'}
                  {page.status === 'draft' && ' · Entwurf'}
                  {page.status === 'suggested' && ` · ${page.reason ?? 'Vorschlag'}`}
                  {page.views > 0 && ` · ${page.views.toLocaleString('de-DE')} Aufrufe (geschätzt)`}
                </p>
              </div>
              <div className="intel-trend-item__actions">
                <span className={`intel-trend-status intel-trend-status--${page.status === 'suggested' ? 'draft' : page.status}`}>
                  {page.status === 'published' ? 'Live' : page.status === 'suggested' ? 'Neu' : 'Geplant'}
                </span>
                {showPublish && (
                  <button
                    type="button"
                    className="intel-trend-publish"
                    onClick={() => onPublishTrend?.(page)}
                  >
                    Veröffentlichen
                  </button>
                )}
                {showUnpublish && (
                  <button
                    type="button"
                    className="intel-trend-unpublish"
                    onClick={() => onUnpublishTrend?.(page.slug)}
                  >
                    Zurückziehen
                  </button>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="Clever Score Gewichtung" subtitle="Später im Admin anpassbar">
        <dl className="intel-weights">
          {Object.entries(scoreWeights).map(([key, weight]) => (
            <div key={key} className="intel-weights__row">
              <dt>{formatWeightLabel(key)}</dt>
              <dd>{Math.round(weight * 100)}%</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    </>
  );
}

function formatWeightLabel(key) {
  const labels = {
    priceValue: 'Preis-Leistung',
    leasingRate: 'Leasingrate',
    deliveryTime: 'Lieferzeit',
    demand: 'Nachfrage',
    equipment: 'Ausstattung',
    range: 'Reichweite',
    familyFriendly: 'Familienfreundlichkeit',
  };
  return labels[key] ?? key;
}
