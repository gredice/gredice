'use client';

import {
    type TableFilterProps as BaseTableFilterProps,
    type FilterOption,
    TIME_FILTER_OPTIONS,
    TableFilter as UiTableFilter,
} from '@gredice/ui/TableFilter';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export type { FilterOption };
export { TIME_FILTER_OPTIONS };

export interface TableFilterProps
    extends Omit<
        BaseTableFilterProps,
        'currentFilters' | 'onFilterChange' | 'onClearAll'
    > {
    defaultValues?: Record<string, string>;
    onFiltersChange?: (filters: Record<string, string>) => void;
}

export function TableFilter({
    filters,
    defaultValues = {},
    onFiltersChange,
    className,
}: TableFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const currentFilters = useMemo(() => {
        const filtersObj: Record<string, string> = {};
        filters.forEach((filter) => {
            const urlValue = searchParams.get(filter.key);
            const value = urlValue || defaultValues[filter.key] || '';
            if (value) {
                filtersObj[filter.key] = value;
            }
        });
        return filtersObj;
    }, [searchParams, filters, defaultValues]);

    const updateFilters = useCallback(
        (key: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value && value !== 'all') {
                params.set(key, value);
            } else {
                params.delete(key);
            }

            const query = params.toString();
            router.push(`${pathname}${query ? `?${query}` : ''}` as Route);

            const newFilters: Record<string, string> = {};
            filters.forEach((filter: FilterOption) => {
                const filterValue =
                    key === filter.key ? value : searchParams.get(filter.key);
                if (filterValue && filterValue !== 'all') {
                    newFilters[filter.key] = filterValue;
                }
            });
            onFiltersChange?.(newFilters);
        },
        [searchParams, router, pathname, onFiltersChange, filters],
    );

    const clearAllFilters = useCallback(() => {
        router.push(pathname as Route);
        onFiltersChange?.({});
    }, [router, onFiltersChange, pathname]);

    return (
        <UiTableFilter
            filters={filters}
            currentFilters={currentFilters}
            onFilterChange={updateFilters}
            onClearAll={clearAllFilters}
            className={className}
        />
    );
}
