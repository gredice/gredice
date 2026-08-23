'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Close, Search } from '@gredice/ui/icons';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';

const INITIAL_VISIBLE_ITEMS = 16;

export type PricingCatalogItem = {
    content: ReactNode;
    filter: string;
    id: string;
    searchText: string;
};

export type PricingCatalogFilter = {
    label: string;
    value: string;
};

export function PricingCatalogList({
    columnHeader,
    emptyMessage,
    filters,
    items,
    searchLabel,
}: {
    columnHeader?: ReactNode;
    emptyMessage: string;
    filters: PricingCatalogFilter[];
    items: PricingCatalogItem[];
    searchLabel: string;
}) {
    const [activeFilter, setActiveFilter] = useState(filters[0]?.value ?? '');
    const [search, setSearch] = useState('');
    const [visibleItems, setVisibleItems] = useState(INITIAL_VISIBLE_ITEMS);
    const normalizedSearch = normalizeSearchText(search);

    const filteredItems = useMemo(
        () =>
            items.filter(
                (item) =>
                    (activeFilter === 'all' || item.filter === activeFilter) &&
                    (!normalizedSearch ||
                        normalizeSearchText(item.searchText).includes(
                            normalizedSearch,
                        )),
            ),
        [activeFilter, items, normalizedSearch],
    );

    const shownItems = filteredItems.slice(0, visibleItems);
    const remainingItems = filteredItems.length - shownItems.length;

    function updateSearch(value: string) {
        setSearch(value);
        setVisibleItems(INITIAL_VISIBLE_ITEMS);
    }

    function updateFilter(value: string) {
        setActiveFilter(value);
        setVisibleItems(INITIAL_VISIBLE_ITEMS);
    }

    return (
        <div>
            <div className="mb-3 flex flex-col gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap gap-2">
                    {filters.map((filter) => (
                        <Chip
                            aria-pressed={activeFilter === filter.value}
                            color={
                                activeFilter === filter.value
                                    ? 'primary'
                                    : 'neutral'
                            }
                            key={filter.value}
                            onClick={() => updateFilter(filter.value)}
                            variant={
                                activeFilter === filter.value
                                    ? 'soft'
                                    : 'outlined'
                            }
                        >
                            {filter.label}
                        </Chip>
                    ))}
                </div>
                <div className="flex h-10 w-full min-w-0 items-center rounded-md border border-border bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:max-w-80">
                    <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
                    <input
                        aria-label={searchLabel}
                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-hidden placeholder:text-muted-foreground"
                        onChange={(event) => updateSearch(event.target.value)}
                        placeholder={searchLabel}
                        type="search"
                        value={search}
                    />
                    <IconButton
                        aria-label="Očisti pretragu"
                        className={search ? 'visible mr-1' : 'invisible mr-1'}
                        onClick={() => updateSearch('')}
                        size="sm"
                        type="button"
                        variant="plain"
                    >
                        <Close className="size-4" />
                    </IconButton>
                </div>
            </div>

            <p className="mb-2 text-xs text-muted-foreground" role="status">
                {filteredItems.length === 1
                    ? 'Prikazana je 1 stavka.'
                    : `Prikazano stavki: ${filteredItems.length}.`}
            </p>

            {shownItems.length > 0 ? (
                <div className="overflow-hidden rounded-lg border">
                    {columnHeader}
                    {shownItems.map((item) => (
                        <div className="border-b last:border-b-0" key={item.id}>
                            {item.content}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                </div>
            )}

            {remainingItems > 0 ? (
                <div className="mt-4 flex justify-center">
                    <Button
                        color="neutral"
                        onClick={() =>
                            setVisibleItems(
                                (current) => current + INITIAL_VISIBLE_ITEMS,
                            )
                        }
                        variant="outlined"
                    >
                        Prikaži još ({remainingItems})
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
