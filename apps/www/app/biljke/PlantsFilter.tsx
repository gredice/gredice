'use client';

import { Input } from "@signalco/ui-primitives/Input";
// import { Search } from "lucide-react";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { useState } from "react";

export function PlantsFilter() {
    const [, setSearch] = useSearchParam('pretraga');
    const [searchInput, setSearchInput] = useState('');

    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
    }

    return (
        // TODO: Extract theme as @signalco/ui-primitives/Input soft variant 
        <form onSubmit={handleSubmit}>
            <Input
                value={searchInput}
                onChange={handleSearchInputChange}
                onBlur={() => setSearch(searchInput)}
                placeholder="Pretraži..."
                // TODO: Apply when losing focus when typing is fixed in @signalco/ui-primitives/Input
                // startDecorator={<Search className="size-5 ml-3" />}
                className="self-start min-w-60 bg-primary/10 shadow-sm border-primary/15" />
        </form>
    )
}