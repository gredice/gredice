'use client';

import { Input } from "@signalco/ui-primitives/Input";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { useState } from "react";
import { Search } from "lucide-react";

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
        <form onSubmit={handleSubmit} className="lg:flex items-start justify-end">
            <Input
                value={searchInput}
                onChange={handleSearchInputChange}
                onBlur={() => setSearch(searchInput)}
                placeholder="Pretraži..."
                startDecorator={<Search className="size-5 ml-3" />}
                className="min-w-60 bg-primary/10 shadow-sm border-muted-foreground/30" />
        </form>
    );
}