export default function LegalSection({ section }) {
  return (
    <section
      id={section.id}
      className={`legal-section${section.highlight ? ' legal-section--highlight' : ''}`}
    >
      <h2 className="legal-section__title">{section.title}</h2>
      {section.paragraphs?.map((text) => (
        <p key={text} className="legal-section__p">{text}</p>
      ))}
      {section.list && (
        <ul className="legal-section__list">
          {section.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {section.note && (
        <p className="legal-section__note">{section.note}</p>
      )}
    </section>
  );
}
