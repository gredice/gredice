'use client';

import {
    createContext,
    type Dispatch,
    type SetStateAction,
    useContext,
    useState,
} from 'react';

export type FilterContextType = {
    filter: string;
    setFilter: Dispatch<SetStateAction<string>>;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
    const [filter, setFilter] = useState('');

    return (
        <FilterContext.Provider value={{ filter, setFilter }}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilter() {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
}
