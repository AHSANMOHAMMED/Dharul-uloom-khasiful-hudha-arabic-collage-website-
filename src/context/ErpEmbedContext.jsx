import { createContext, useContext } from 'react';

/** When true, ERP panels hide their own PageHeader (portal chrome already titles the tab). */
const ErpEmbedContext = createContext(false);

export function ErpEmbedProvider({ embedded = true, children }) {
  return <ErpEmbedContext.Provider value={embedded}>{children}</ErpEmbedContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useErpEmbedded() {
  return useContext(ErpEmbedContext);
}
