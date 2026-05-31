import { useRef, useState } from 'react';
import { IMPORT_BRANDS } from '../../../data/priceListImport.js';
import './ImportUploadForm.css';

export default function ImportUploadForm({ onSubmit, disabled }) {
  const inputRef = useRef(null);
  const [brand, setBrand] = useState('Kia');
  const [model, setModel] = useState('Sportage');
  const [modelYear, setModelYear] = useState(String(new Date().getFullYear() + 1));
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(f) {
    if (!f) return;
    if (f.type !== 'application/pdf') return;
    setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!file || disabled) return;
    onSubmit({ brand, model, modelYear }, file);
  }

  const canSubmit = Boolean(file) && model.trim() && modelYear.trim() && !disabled;

  return (
    <form className="import-upload" onSubmit={handleSubmit}>
      <div className="import-upload__fields">
        <label className="import-upload__field">
          <span>Hersteller</span>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {IMPORT_BRANDS.map((b) => (
              <option key={b.id} value={b.label}>{b.label}</option>
            ))}
          </select>
        </label>
        <label className="import-upload__field">
          <span>Modell</span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="z. B. Sportage"
          />
        </label>
        <label className="import-upload__field">
          <span>Modelljahr</span>
          <input
            type="number"
            min={2024}
            max={2035}
            value={modelYear}
            onChange={(e) => setModelYear(e.target.value)}
          />
        </label>
      </div>

      <div
        className={`import-upload__drop${dragOver ? ' is-dragover' : ''}${file ? ' has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="import-upload__input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <span className="import-upload__icon" aria-hidden>📄</span>
        {file ? (
          <>
            <p className="import-upload__filename">{file.name}</p>
            <p className="import-upload__hint">
              {(file.size / 1024 / 1024).toFixed(1)} MB · Tippen zum Ersetzen
            </p>
          </>
        ) : (
          <>
            <p className="import-upload__title">PDF hier ablegen</p>
            <p className="import-upload__hint">oder tippen zum Auswählen · Hersteller-Preisliste</p>
          </>
        )}
      </div>

      <button type="submit" className="import-upload__submit" disabled={!canSubmit}>
        {disabled ? 'Analyse läuft…' : 'Preisliste analysieren'}
      </button>
    </form>
  );
}
