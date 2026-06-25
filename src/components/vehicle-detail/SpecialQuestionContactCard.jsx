import { useState } from 'react';
import {
  SPECIAL_QUESTION_COPY,
  validateSpecialQuestionContact,
} from '../../services/dealer/specialCustomerQuestionService.js';
import './SpecialQuestionContactCard.css';

export default function SpecialQuestionContactCard({
  questionText,
  onSubmit,
  onDismiss,
  submitting = false,
  submitted = false,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState(questionText ?? '');
  const [error, setError] = useState(null);

  function handleSubmit(event) {
    event.preventDefault();
    const validation = validateSpecialQuestionContact({ phone, email });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError(null);
    onSubmit?.({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      question: question.trim(),
    });
  }

  if (submitted) {
    return (
      <aside className="sq-contact sq-contact--done" aria-live="polite">
        <p className="sq-contact__headline">Vorgemerkt – Ihr Verkäufer meldet sich.</p>
        <p className="sq-contact__text">
          Clever hat Ihre Frage weitergegeben. Ein Experte prüft, was möglich ist.
        </p>
      </aside>
    );
  }

  return (
    <aside className="sq-contact" aria-labelledby="sq-contact-title">
      <p className="sq-contact__kicker">Clever Einschätzung</p>
      <h3 id="sq-contact-title" className="sq-contact__headline">
        {SPECIAL_QUESTION_COPY.headline}
      </h3>
      <p className="sq-contact__text">{SPECIAL_QUESTION_COPY.text}</p>

      <div className="sq-contact__card">
        <h4 className="sq-contact__card-title">{SPECIAL_QUESTION_COPY.contactHeadline}</h4>
        <form className="sq-contact__form" onSubmit={handleSubmit} noValidate>
          <label className="sq-contact__field">
            <span className="sq-contact__label">Name</span>
            <input
              type="text"
              className="sq-contact__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional – hilft beim Anruf"
              autoComplete="name"
            />
          </label>
          <label className="sq-contact__field">
            <span className="sq-contact__label">Telefon</span>
            <input
              type="tel"
              className="sq-contact__input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Für Rückruf"
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
          <label className="sq-contact__field">
            <span className="sq-contact__label">E-Mail</span>
            <input
              type="email"
              className="sq-contact__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Alternative Kontaktmöglichkeit"
              autoComplete="email"
              inputMode="email"
            />
          </label>
          <label className="sq-contact__field">
            <span className="sq-contact__label">Ihre Frage</span>
            <textarea
              className="sq-contact__input sq-contact__input--area"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>

          {error && (
            <p className="sq-contact__error" role="status">{error}</p>
          )}

          <button
            type="submit"
            className="sq-contact__cta sq-contact__cta--primary"
            disabled={submitting}
          >
            {SPECIAL_QUESTION_COPY.contactCta}
          </button>
          <button
            type="button"
            className="sq-contact__cta sq-contact__cta--ghost"
            onClick={onDismiss}
            disabled={submitting}
          >
            {SPECIAL_QUESTION_COPY.dismissCta}
          </button>
        </form>
      </div>
    </aside>
  );
}
