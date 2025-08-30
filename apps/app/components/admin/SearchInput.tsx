'use client';

import { Search } from '@signalco/ui-icons';
import { Input } from '@signalco/ui-primitives/Input';
import { useFilter } from './providers';

export function SearchInput() {
    const { filter, setFilter } = useFilter();

    return (
        <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Pretraži..."
            startDecorator={<Search className="size-5 shrink-0 ml-3" />}
        />
    );
}
