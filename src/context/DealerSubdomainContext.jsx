import { createContext, useContext, useMemo } from 'react';
import {
  buildDealerSubdomainUrl,
  getDealerSlugFromHost,
  getMainSiteUrl,
} from '../logic/dealerSubdomain.js';
import { getDealerRegistryEntry } from '../data/dealers/index.js';

const DealerSubdomainContext = createContext({
  dealerId: null,
  isSubdomain: false,
  subdomainUrl: null,
  mainSiteUrl: 'https://www.clever-neuwagen.de',
  dealerName: null,
});

export function DealerSubdomainProvider({ children }) {
  const value = useMemo(() => {
    const dealerId = getDealerSlugFromHost();
    const registry = dealerId ? getDealerRegistryEntry(dealerId) : null;

    return {
      dealerId,
      isSubdomain: Boolean(dealerId),
      subdomainUrl: dealerId ? buildDealerSubdomainUrl(dealerId) : null,
      mainSiteUrl: getMainSiteUrl('/'),
      dealerName: registry?.seed?.dealerName ?? null,
    };
  }, []);

  return (
    <DealerSubdomainContext.Provider value={value}>
      {children}
    </DealerSubdomainContext.Provider>
  );
}

export function useDealerSubdomain() {
  return useContext(DealerSubdomainContext);
}
