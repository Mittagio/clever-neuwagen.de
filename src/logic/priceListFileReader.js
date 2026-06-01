const ACCEPTED_TYPES = {
  pdf: ['application/pdf'],
  csv: ['text/csv', 'application/csv', 'text/plain'],
  excel: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
};

export function detectFileFormat(file) {
  const name = (file?.name ?? '').toLowerCase();
  if (ACCEPTED_TYPES.pdf.includes(file?.type) || name.endsWith('.pdf')) return 'pdf';
  if (ACCEPTED_TYPES.csv.includes(file?.type) || name.endsWith('.csv')) return 'csv';
  if (ACCEPTED_TYPES.excel.includes(file?.type) || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return 'excel';
  }
  return null;
}

export function isAcceptedPriceListFile(file) {
  return detectFileFormat(file) != null;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsText(file, 'UTF-8');
  });
}

/** Excel-Demo: erste Zeilen als Text (Tab-getrennt simuliert) */
export async function readExcelAsText(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text = '';
  for (let i = 0; i < Math.min(bytes.length, 8000); i += 1) {
    const c = bytes[i];
    if (c >= 32 && c < 127) text += String.fromCharCode(c);
    else if (c === 9 || c === 10 || c === 13) text += '\n';
  }
  return text;
}

export async function extractFileContent(file) {
  const format = detectFileFormat(file);
  if (!format) throw new Error('Format nicht unterstützt. Erlaubt: PDF, Excel (.xlsx), CSV.');

  if (typeof file.arrayBuffer !== 'function') {
    return { format, text: '', fileName: file.name };
  }

  if (format === 'csv') {
    return { format, text: await readFileAsText(file) };
  }
  if (format === 'excel') {
    return { format, text: await readExcelAsText(file) };
  }
  return { format, text: '', fileName: file.name };
}
