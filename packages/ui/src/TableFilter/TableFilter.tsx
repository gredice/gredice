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
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

export interface FilterOption {
    key: string;
    label: string;
    icon?: ReactNode;
    options: Array<{
        value: string;
        label: string;
        icon?: ReactNode;
    }>;
}

export interface TableFilterProps {
    filters: FilterOption[];
    currentFilters: Record<string, string>;
    onFilterChange: (key: string, value: string) => void;
    onClearAll: () => void;
    className?: string;
}

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
    currentFilters,
    onFilterChange,
    onClearAll,
    className,
}: TableFilterProps) {
    const activeFilterCount = useMemo(
        () => Object.values(currentFilters).filter(Boolean).length,
        [currentFilters],
    );

    const getOptionLabel = useCallback(
        (filter: FilterOption, value: string) => {
            const option = filter.options.find((opt) => opt.value === value);
            return option?.label || value;
        },
        [],
    );

    return (
        <div className={className}>
            <Row spacing={2} className="items-center flex-wrap">
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

                        {filters.map((filter, filterIndex) => (
                            <div key={filter.key}>
                                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1 flex items-center gap-2">
                                    {filter.icon}
                                    {filter.label}
                                </DropdownMenuLabel>
                                {filter.options.map((option) => (
                                    <DropdownMenuItem
                                        key={`${filter.key}-${option.value}`}
                                        onClick={() =>
                                            onFilterChange(
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
                                {filterIndex < filters.length - 1 && (
                                    <DropdownMenuSeparator />
                                )}
                            </div>
                        ))}

                        {activeFilterCount > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={onClearAll}
                                    className="text-destructive cursor-pointer"
                                >
                                    <Close className="size-4 mr-2" />
                                    Očisti sve filtere
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {Object.entries(currentFilters).map(([key, value]) => {
                    const filter = filters.find((f) => f.key === key);
                    if (!filter) return null;

                    return (
                        <Chip
                            key={key}
                            color="neutral"
                            size="sm"
                            onClick={() => onFilterChange(key, '')}
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
