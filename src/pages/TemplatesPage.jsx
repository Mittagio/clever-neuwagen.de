import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemplates } from '../context/TemplatesContext.jsx';
import './TemplatesPage.css';

export default function TemplatesPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const [draft, setDraft] = useState({ title: '', body: '' });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', body: '' });

  function handleCreate(e) {
    e.preventDefault();
    if (!draft.body.trim()) return;
    addTemplate(draft);
    setDraft({ title: '', body: '' });
  }

  function startEdit(template) {
    setEditingId(template.id);
    setEditDraft({ title: template.title, body: template.body });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ title: '', body: '' });
  }

  function handleSaveEdit(id) {
    if (!editDraft.body.trim()) return;
    updateTemplate(id, editDraft);
    cancelEdit();
  }

  function handleDelete(id) {
    if (window.confirm('Vorlage wirklich löschen?')) {
      deleteTemplate(id);
      if (editingId === id) cancelEdit();
    }
  }

  return (
    <div className="templates-page">
      <header className="templates-page__header">
        <Link to="/communication" className="templates-page__back">←</Link>
        <div>
          <h1 className="templates-page__title">Schnellantworten</h1>
          <p className="templates-page__sub">Vorlagen für WhatsApp, Mail &amp; Kopieren</p>
        </div>
      </header>

      <main className="templates-page__main">
        <form className="templates-page__new card" onSubmit={handleCreate}>
          <h2 className="templates-page__section-title">Neue Vorlage</h2>
          <label className="templates-page__field">
            <span>Titel (optional)</span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="z. B. Danke für Anfrage"
            />
          </label>
          <label className="templates-page__field">
            <span>Text</span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Vielen Dank für Ihre Anfrage."
              rows={3}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary templates-page__save">
            Speichern
          </button>
        </form>

        <section className="templates-page__list">
          <h2 className="templates-page__section-title">
            Gespeicherte Vorlagen ({templates.length})
          </h2>

          {templates.length === 0 ? (
            <p className="templates-page__empty">Noch keine Vorlagen gespeichert.</p>
          ) : (
            templates.map((tpl) => (
              <article key={tpl.id} className="templates-page__card card">
                {editingId === tpl.id ? (
                  <>
                    <label className="templates-page__field">
                      <span>Titel</span>
                      <input
                        type="text"
                        value={editDraft.title}
                        onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                    </label>
                    <label className="templates-page__field">
                      <span>Text</span>
                      <textarea
                        value={editDraft.body}
                        onChange={(e) => setEditDraft((d) => ({ ...d, body: e.target.value }))}
                        rows={3}
                      />
                    </label>
                    <div className="templates-page__actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleSaveEdit(tpl.id)}
                      >
                        Speichern
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                        Abbrechen
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="templates-page__card-title">{tpl.title}</h3>
                    <p className="templates-page__card-body">{tpl.body}</p>
                    <div className="templates-page__actions">
                      <button
                        type="button"
                        className="templates-page__btn templates-page__btn--edit"
                        onClick={() => startEdit(tpl)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="templates-page__btn templates-page__btn--delete"
                        onClick={() => handleDelete(tpl.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
