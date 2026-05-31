import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_TEMPLATES } from '../data/defaultTemplates.js';

const STORAGE_KEY = 'clever-neuwagen-templates';

const TemplatesContext = createContext(null);

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* Fallback */
  }
  return [...DEFAULT_TEMPLATES];
}

function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function uid() {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function TemplatesProvider({ children }) {
  const [templates, setTemplates] = useState(loadTemplates);

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          setTemplates(JSON.parse(event.newValue));
        } catch {
          /* ignorieren */
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const api = useMemo(() => ({
    templates,

    addTemplate({ title, body }) {
      const now = new Date().toISOString();
      const template = {
        id: uid(),
        title: title?.trim() || body.trim().slice(0, 40),
        body: body.trim(),
        createdAt: now,
        updatedAt: now,
      };
      setTemplates((prev) => [template, ...prev]);
      return template;
    },

    updateTemplate(id, { title, body }) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                title: title?.trim() || t.title,
                body: body?.trim() ?? t.body,
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      );
    },

    deleteTemplate(id) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },

    getTemplate(id) {
      return templates.find((t) => t.id === id) ?? null;
    },
  }), [templates]);

  return (
    <TemplatesContext.Provider value={api}>
      {children}
    </TemplatesContext.Provider>
  );
}

export function useTemplates() {
  const ctx = useContext(TemplatesContext);
  if (!ctx) {
    throw new Error('useTemplates muss innerhalb von TemplatesProvider verwendet werden');
  }
  return ctx;
}
