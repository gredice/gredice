'use client';

import { Calendar, Close, Filter } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { Row } from '@signalco/ui-primitives/Row';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export interface FilterOption {
    key: string;
    label: string;
    icon?: React.ReactNode;
    options: Array<{
        value: string;
        label: string;
        icon?: React.ReactNode;
    }>;
}

export interface TableFilterProps {
    filters: FilterOption[];
    defaultValues?: Record<string, string>;
    onFiltersChange?: (filters: Record<string, string>) => void;
    className?: string;
}

// Predefined time filter options for easy reuse
export const TIME_FILTER_OPTIONS: FilterOption = {
    key: 'from',
    label: 'Vremenski period',
    icon: <Calendar className="size-4" />,
    options: [
        { value: '', label: 'Sve vrijeme' },
        { value: 'today', label: 'Danas' },
        { value: 'yesterday', label: 'Jučer' },
        { value: 'last-7-days', label: 'Zadnjih 7 dana' },
        { value: 'last-14-days', label: 'Zadnjih 14 dana' },
        { value: 'last-30-days', label: 'Zadnjih 30 dana' },
        { value: 'last-90-days', label: 'Zadnjih 90 dana' },
        { value: 'this-month', label: 'Ovaj mjesec' },
        { value: 'last-month', label: 'Prošli mjesec' },
        { value: 'this-year', label: 'Ova godina' },
        { value: 'last-year', label: 'Prošla godina' },
    ],
};

export function TableFilter({
    filters,
    defaultValues = {},
    onFiltersChange,
    className,
}: TableFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Get current filter values from URL or defaults
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

    // Get active filter count for display
    const activeFilterCount =
        Object.values(currentFilters).filter(Boolean).length;

    // Update URL and notify parent component
    const updateFilters = useCallback(
        (key: string, value: string) => {
            // Update URL
            const params = new URLSearchParams(searchParams.toString());
            if (value && value !== 'all' && value !== '') {
                params.set(key, value);
            } else {
                params.delete(key);
            }

            const query = params.toString();
            router.push(`${pathname}${query ? `?${query}` : ''}` as Route);

            // Notify parent component with new filters
            const newFilters: Record<string, string> = {};
            filters.forEach((filter) => {
                const filterValue =
                    key === filter.key ? value : searchParams.get(filter.key);
                if (
                    filterValue &&
                    filterValue !== 'all' &&
                    filterValue !== ''
                ) {
                    newFilters[filter.key] = filterValue;
                }
            });
            onFiltersChange?.(newFilters);
        },
        [searchParams, router, pathname, onFiltersChange, filters],
    );

    // Clear all filters
    const clearAllFilters = useCallback(() => {
        router.push(pathname as Route);
        onFiltersChange?.({});
    }, [router, onFiltersChange, pathname]);

    // Get label for filter option
    const getOptionLabel = (filter: FilterOption, value: string) => {
        const option = filter.options.find((opt) => opt.value === value);
        return option?.label || value;
    };

    return (
        <div className={className}>
            <Row spacing={2} className="items-center flex-wrap">
                {/* Notion-style Filters Button */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outlined"
                            size="sm"
                            startDecorator={
                                <Filter className="size-4 shrink-0" />
                            }
                            className="relative rounded-full"
                        >
                            {activeFilterCount > 0 && (
                                <Chip
                                    size="sm"
                                    color="info"
                                    className="ml-2 px-1.5 py-0.5 text-xs min-w-fit"
                                >
                                    {activeFilterCount}
                                </Chip>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64">
                        <DropdownMenuLabel>Filtriraj po</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {/* Filter Categories - Flat Structure */}
                        {filters.map((filter) => (
                            <div key={filter.key}>
                                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1 flex items-center gap-2">
                                    {filter.icon}
                                    {filter.label}
                                </DropdownMenuLabel>
                                {filter.options.map((option) => (
                                    <DropdownMenuItem
                                        key={`${filter.key}-${option.value}`}
                                        onClick={() =>
                                            updateFilters(
                                                filter.key,
                                                option.value,
                                            )
                                        }
                                        className="justify-between cursor-pointer pl-6"
                                    >
                                        <Row
                                            spacing={2}
                                            className="items-center"
                                        >
                                            {option.icon}
                                            <span>{option.label}</span>
                                        </Row>
                                        {currentFilters[filter.key] ===
                                            option.value && (
                                            <div className="w-2 h-2 bg-primary rounded-full" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                                {/* Separator between filter groups, except for last */}
                                {filters.indexOf(filter) <
                                    filters.length - 1 && (
                                    <DropdownMenuSeparator />
                                )}
                            </div>
                        ))}

                        {/* Clear All Option */}
                        {activeFilterCount > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={clearAllFilters}
                                    className="text-destructive cursor-pointer"
                                >
                                    <Close className="size-4 mr-2" />
                                    Očisti sve filtere
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Active Filter Chips */}
                {Object.entries(currentFilters).map(([key, value]) => {
                    const filter = filters.find((f) => f.key === key);
                    if (!filter) return null;

                    return (
                        <Chip
                            key={key}
                            color="neutral"
                            size="sm"
                            onClick={() => updateFilters(key, '')}
                        >
                            <Row spacing={1} className="items-center">
                                {filter.icon}
                                <span>
                                    {filter.label}:{' '}
                                    {getOptionLabel(filter, value)}
                                </span>
                                <Close className="size-3" />
                            </Row>
                        </Chip>
                    );
                })}
            </Row>
        </div>
    );
}
