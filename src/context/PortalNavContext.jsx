import { createContext, useContext } from 'react';

/**
 * Lets embedded ERP dashboards switch portal tabs (or fall back to /erp)
 * instead of writing unused ?module= params on /dashboard.
 */
const PortalNavContext = createContext(null);

export function PortalNavProvider({ value, children }) {
  return <PortalNavContext.Provider value={value}>{children}</PortalNavContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortalNav() {
  return useContext(PortalNavContext);
}
