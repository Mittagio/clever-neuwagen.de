import { DEALER_WHY_BENEFITS } from '../../data/dealerLandingContent.js';
import './dealer-landing.css';

export default function DealerWhySection({ dealerName, contact = {} }) {
  const name = contact.name || dealerName;
  const phone = contact.phone || '';
  const email = contact.email || '';

  return (
    <section className="dl-why" aria-labelledby="dl-why-heading">
      <h2 id="dl-why-heading" className="dl-section__title">
        Warum Kunden bei {dealerName} kaufen
      </h2>
      <div className="dl-why__layout">
        <ul className="dl-why__benefits">
          {DEALER_WHY_BENEFITS.map((item) => (
            <li key={item.id} className="dl-why__benefit">
              <span className="dl-why__icon" aria-hidden>{item.icon}</span>
              <strong>{item.title}</strong>
            </li>
          ))}
        </ul>
        <article className="dl-why__contact card">
          <p className="dl-why__contact-kicker">Ihr Ansprechpartner</p>
          <p className="dl-why__contact-name">{name}</p>
          <p className="dl-why__contact-role">{contact.role || 'Verkauf Neuwagen'}</p>
          {phone && (
            <p>
              <a href={`tel:${phone}`}>{phone}</a>
            </p>
          )}
          {email && (
            <p>
              <a href={`mailto:${email}`}>{email}</a>
            </p>
          )}
          {phone && (
            <a
              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
              className="dl-why__whatsapp"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp schreiben
            </a>
          )}
        </article>
      </div>
    </section>
  );
}
