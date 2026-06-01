import { useRef, useState } from 'react';
import { IMPORT_BRANDS } from '../../../data/priceListImport.js';
import { isAcceptedPriceListFile } from '../../../logic/priceListFileReader.js';
import ImportExamples from './ImportExamples.jsx';
import './ImportUploadForm.css';

const ACCEPT = '.pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function ImportUploadForm({ onSubmit, disabled }) {
  const inputRef = useRef(null);
  const [brand, setBrand] = useState('Kia');
  const [model, setModel] = useState('Sportage');
  const [modelYear, setModelYear] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');

  function handleFile(f) {
    if (!f) return;
    if (!isAcceptedPriceListFile(f)) {
      setFileError('Bitte PDF, Excel (.xlsx) oder CSV hochladen.');
      setFile(null);
      return;
    }
    setFileError('');
    setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!file || disabled) return;
    onSubmit({ brand, model, modelYear }, file);
  }

  function handleExample(ex) {
    setBrand(ex.brand);
    setModel(ex.model);
    setFileError('');
    setFile({
      name: ex.fileName,
      size: 2400000,
      type: ex.format === 'PDF' ? 'application/pdf' : ex.format === 'CSV' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
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
            placeholder="z. B. Sportage, EV4, RAV4"
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
          accept={ACCEPT}
          className="import-upload__input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <span className="import-upload__icon" aria-hidden>📋</span>
        {file ? (
          <>
            <p className="import-upload__filename">{file.name}</p>
            <p className="import-upload__hint">
              {(file.size / 1024 / 1024).toFixed(1)} MB · Tippen zum Ersetzen
            </p>
          </>
        ) : (
          <>
            <p className="import-upload__title">PDF, Excel oder CSV</p>
            <p className="import-upload__hint">Ablegen oder auswählen · Hersteller-Preisliste</p>
          </>
        )}
      </div>

      {fileError && <p className="import-upload__error" role="alert">{fileError}</p>}

      <ImportExamples onSelectExample={handleExample} />

      <button type="submit" className="import-upload__submit" disabled={!canSubmit}>
        {disabled ? 'KI-Analyse läuft…' : 'Mit KI analysieren'}
      </button>
    </form>
  );
}
