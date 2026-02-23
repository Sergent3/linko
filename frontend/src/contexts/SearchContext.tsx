'use client';

import { createContext, useContext, useState } from 'react';

interface SearchContextValue {
  search: string;
  setSearch: (s: string) => void;
}

const SearchContext = createContext<SearchContextValue>({ search: '', setSearch: () => {} });

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState('');
  return (
    <SearchContext.Provider value={{ search, setSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

export const useSearch = () => useContext(SearchContext);
