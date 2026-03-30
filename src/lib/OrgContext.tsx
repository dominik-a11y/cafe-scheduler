'use client';

import { createContext, useContext } from 'react';

interface OrgContextType {
  orgId: string;
  userRole: 'admin' | 'employee';
  userId: string;
}

export const OrgContext = createContext<OrgContextType | null>(null);

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgContext.Provider');
  return ctx;
}
