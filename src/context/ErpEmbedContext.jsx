import { createContext, useContext } from 'react';

/** When true, ERP panels hide their own PageHeader (portal chrome already titles the tab). */
const ErpEmbedContext = createContext(false);

export function ErpEmbedProvider({ embedded = true, children }) {
  return <ErpEmbedContext.Provider value={embedded}>{children}</ErpEmbedContext.Provider>;
}

export function useErpEmbedded() {
  return useContext(ErpEmbedContext);
}
