'use client';

import { ExpandableSearchInput } from '@gredice/ui/ExpandableSearchInput';
import { useFilter } from './providers';

export function SearchInput() {
    const { filter, setFilter } = useFilter();

    return (
        <ExpandableSearchInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            inputClassName="min-w-60"
        />
    );
}
