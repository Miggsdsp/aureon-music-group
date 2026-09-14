'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicCatalogue } from '@/lib/public-catalogue';

const PublicCatalogueContext = createContext<PublicCatalogue | null>(null);
export const useInitialPublicCatalogue = () => useContext(PublicCatalogueContext);

export function PublicCatalogueProvider({ catalogue, children }: { catalogue: PublicCatalogue; children: ReactNode }) {
  return <PublicCatalogueContext.Provider value={catalogue}>{children}</PublicCatalogueContext.Provider>;
}
