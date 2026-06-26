import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  countOpenInboxItems,
  countOpenQuestionInboxItems,
  createInboxItem,
  ignoreInboxItem,
  listInboxItems,
  markInboxItemDone,
  syncInboxItemsFromLead,
} from '../services/crm/cleverInboxService.js';

const CleverInboxContext = createContext(null);

export function CleverInboxProvider({ children, leads = [] }) {
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!leads.length) return;
    leads.forEach((lead) => syncInboxItemsFromLead(lead));
    bump();
  }, [leads, bump]);

  const openCount = useMemo(() => countOpenInboxItems(), [version]);
  const openQuestionCount = useMemo(() => countOpenQuestionInboxItems(), [version]);

  const value = useMemo(() => ({
    version,
    openCount,
    openQuestionCount,
    listItems: (filter = {}) => listInboxItems(filter),
    listForCustomer: (customerId) => listInboxItems({ customerId, status: 'open' }),
    countForCustomer: (customerId) => countOpenInboxItems({ customerId }),
    createItem: (input) => {
      const item = createInboxItem(input);
      bump();
      return item;
    },
    markDone: (id) => {
      const item = markInboxItemDone(id);
      bump();
      return item;
    },
    ignore: (id) => {
      const item = ignoreInboxItem(id);
      bump();
      return item;
    },
    refresh: bump,
  }), [version, openCount, openQuestionCount, bump]);

  return (
    <CleverInboxContext.Provider value={value}>
      {children}
    </CleverInboxContext.Provider>
  );
}

export function useCleverInbox() {
  const ctx = useContext(CleverInboxContext);
  if (!ctx) {
    throw new Error('useCleverInbox muss innerhalb von CleverInboxProvider verwendet werden');
  }
  return ctx;
}

export function useCleverInboxOptional() {
  return useContext(CleverInboxContext);
}
