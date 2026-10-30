import { createContext, useContext, type ReactNode } from 'react';
import { defaultCompetitionsApi, type CompetitionsApi } from './api';

const Context = createContext<CompetitionsApi>(defaultCompetitionsApi);
export function CompetitionsProvider({ api, children }: { api: CompetitionsApi; children: ReactNode }) {
  return <Context.Provider value={api}>{children}</Context.Provider>;
}
export function useCompetitionsApi(): CompetitionsApi {
  return useContext(Context);
}
