import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemplates } from '../../context/TemplatesContext.jsx';
import { TEMPLATE_CATEGORIES } from '../../data/communicationTypes.js';
import '../../components/communication/CommunicationComponents.css';

export default function CommunicationTemplatesPage() {
  const { templates, updateTemplate, addTemplate } = useTemplates();
  const [category, setCategory] = useState('erstkontakt');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const filtered = templates.filter(
    (t) => (t.category ?? 'nachfassen') === category,
  );

  function handleSave(id, title, body) {
    updateTemplate(id, { title, body, category });
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!newBody.trim()) return;
    addTemplate({ title: newTitle, body: newBody, category });
    setNewTitle('');
    setNewBody('');
  }

  return (
    <div className="comm-subpage">
      <header className="comm-subpage__head">
        <Link to="/communication" className="comm-subpage__back">←</Link>
        <h1>Vorlagenbibliothek</h1>
      </header>

      <div className="comm-templates__cats">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`comm-templates__cat${category === cat.id ? ' is-active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.map((tpl) => (
        <TemplateEditor
          key={tpl.id}
          template={tpl}
          onSave={handleSave}
        />
      ))}

      {filtered.length === 0 && (
        <p className="comm-subpage__hint">Keine Vorlagen in dieser Kategorie.</p>
      )}

      <form className="comm-subpage__card" onSubmit={handleAdd}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Neue Vorlage</h2>
        <input
          className="comm-subpage__input"
          placeholder="Titel"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <textarea
          className="comm-subpage__textarea"
          placeholder="Text ({{name}}, {{vehicle}}, {{dealer}})"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
        />
        <button type="submit" className="comm-subpage__btn">Vorlage anlegen</button>
      </form>
    </div>
  );
}

function TemplateEditor({ template, onSave }) {
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);

  return (
    <article className="comm-templates__item">
      <h3>{template.title}</h3>
      <input
        className="comm-subpage__input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Titel"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Text"
      />
      <button
        type="button"
        className="comm-templates__save"
        onClick={() => onSave(template.id, title, body)}
      >
        Speichern
      </button>
    </article>
  );
}
