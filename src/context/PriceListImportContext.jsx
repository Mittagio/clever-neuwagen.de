import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEMO_IMPORT_HISTORY,
  STORAGE_KEY,
  createImportRecord,
} from '../data/priceListImport.js';
import { analyzePriceList } from '../logic/analyzePriceList.js';

const PriceListImportContext = createContext(null);

function loadImports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* Fallback */
  }
  return [...DEMO_IMPORT_HISTORY];
}

function saveImports(imports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(imports));
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate()
    && d.getMonth() === now.getMonth()
    && d.getFullYear() === now.getFullYear();
}

export function PriceListImportProvider({ children }) {
  const [imports, setImports] = useState(loadImports);
  const [reviewImport, setReviewImport] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

  useEffect(() => {
    saveImports(imports);
  }, [imports]);

  const api = useMemo(() => ({
    imports,
    reviewImport,
    analyzing,
    analyzeError,

    async uploadAndAnalyze(meta, file) {
      setAnalyzeError(null);
      setAnalyzing(true);
      setReviewImport(null);
      try {
        const result = await analyzePriceList(file, meta);
        const record = createImportRecord(meta, file, result);
        setReviewImport(record);
        return record;
      } catch (err) {
        setAnalyzeError(err.message ?? 'Analyse fehlgeschlagen');
        return null;
      } finally {
        setAnalyzing(false);
      }
    },

    approveImport(id) {
      const target = reviewImport?.id === id
        ? reviewImport
        : imports.find((i) => i.id === id);
      if (!target) return;

      const approved = {
        ...target,
        status: 'approved',
        approved: true,
        approvedAt: new Date().toISOString(),
      };

      setImports((prev) => {
        const without = prev.filter((i) => i.id !== id);
        return [approved, ...without];
      });
      setReviewImport(null);
      return approved;
    },

    rejectImport(id) {
      const target = reviewImport?.id === id
        ? reviewImport
        : imports.find((i) => i.id === id);
      if (!target) return;

      const rejected = {
        ...target,
        status: 'rejected',
        approved: false,
        approvedAt: null,
      };

      setImports((prev) => [rejected, ...prev.filter((i) => i.id !== id)]);
      setReviewImport(null);
    },

    clearReview() {
      setReviewImport(null);
      setAnalyzeError(null);
    },

    getHistory() {
      return imports
        .filter((i) => i.status === 'approved')
        .sort((a, b) => new Date(b.approvedAt ?? b.uploadedAt) - new Date(a.approvedAt ?? a.uploadedAt));
    },

    getAllRecords() {
      return [...imports].sort(
        (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt),
      );
    },

    getMetrics() {
      const allRecords = reviewImport
        && !imports.some((i) => i.id === reviewImport.id)
        ? [reviewImport, ...imports]
        : imports;

      const approved = allRecords.filter((i) => i.status === 'approved');
      const pending = reviewImport ? 1 : allRecords.filter((i) => i.status === 'review').length;
      const todayCount = allRecords.filter((i) => isToday(i.uploadedAt)).length;
      const lastApproved = [...approved].sort(
        (a, b) => new Date(b.approvedAt ?? b.uploadedAt) - new Date(a.approvedAt ?? a.uploadedAt),
      )[0];

      return {
        total: allRecords.length,
        today: todayCount,
        pending,
        lastUpdate: lastApproved?.approvedAt ?? lastApproved?.uploadedAt ?? null,
      };
    },
  }), [imports, reviewImport, analyzing, analyzeError]);

  return (
    <PriceListImportContext.Provider value={api}>
      {children}
    </PriceListImportContext.Provider>
  );
}

export function usePriceListImport() {
  const ctx = useContext(PriceListImportContext);
  if (!ctx) {
    throw new Error('usePriceListImport muss innerhalb von PriceListImportProvider verwendet werden');
  }
  return ctx;
}
