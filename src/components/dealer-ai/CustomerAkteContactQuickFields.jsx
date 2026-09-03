import {
  applyEmailDomain,
  applyPhonePrefix,
  CONTACT_EMAIL_DOMAINS,
  CONTACT_PHONE_PREFIXES,
} from '../../services/dealer/contactQuickInput.js';
import './CustomerAkteContactQuickFields.css';

/**
 * Telefon + E-Mail mit Prefix-/Domain-Chips (weniger Tippen).
 */
export default function CustomerAkteContactQuickFields({
  phone = '',
  email = '',
  onPhoneChange,
  onEmailChange,
}) {
  return (
    <div className="cust-contact-quick">
      <label className="cust-contact-quick__field" htmlFor="cust-quick-phone">
        <span className="cust-contact-quick__label">Telefon</span>
        <input
          id="cust-quick-phone"
          className="cust-contact-quick__input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => onPhoneChange?.(e.target.value)}
          placeholder="0170 …"
        />
        <div className="cust-contact-quick__chips" role="group" aria-label="Vorwahl">
          {CONTACT_PHONE_PREFIXES.map((prefix) => (
            <button
              key={prefix}
              type="button"
              className={`cust-contact-quick__chip${String(phone).replace(/\D/g, '').startsWith(prefix) ? ' is-active' : ''}`}
              onClick={() => onPhoneChange?.(applyPhonePrefix(phone, prefix))}
            >
              {prefix}
            </button>
          ))}
        </div>
      </label>

      <label className="cust-contact-quick__field" htmlFor="cust-quick-email">
        <span className="cust-contact-quick__label">E-Mail</span>
        <input
          id="cust-quick-email"
          className="cust-contact-quick__input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange?.(e.target.value)}
          placeholder="name@"
        />
        <div className="cust-contact-quick__chips" role="group" aria-label="E-Mail-Domain">
          {CONTACT_EMAIL_DOMAINS.map((domain) => {
            const active = String(email).toLowerCase().endsWith(domain);
            return (
              <button
                key={domain}
                type="button"
                className={`cust-contact-quick__chip${active ? ' is-active' : ''}`}
                onClick={() => onEmailChange?.(applyEmailDomain(email, domain))}
              >
                {domain}
              </button>
            );
          })}
        </div>
      </label>
    </div>
  );
}
