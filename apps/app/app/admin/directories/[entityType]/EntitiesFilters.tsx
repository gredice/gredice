'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import {
    Check,
    Close,
    Edit,
    ListTodo,
    Megaphone,
    Warning,
} from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Row } from '@gredice/ui/Row';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import {
    type FilterOption,
    TableFilter,
} from '../../../../components/shared/filters';
import type { DirectoryEntityFilterOption } from './directoryEntityListTypes';

const COMPLETION_FILTER_OPTIONS: FilterOption = {
    key: 'completion',
    label: 'Ispunjenost',
    icon: <Check className="size-4" />,
    options: [
        { value: '', label: 'Svi zapisi' },
        {
            value: 'complete',
            label: 'Ispunjeni',
            icon: <Check className="size-4" />,
        },
        {
            value: 'incomplete',
            label: 'Nepotpuni',
            icon: <Warning className="size-4" />,
        },
    ],
};

const PUBLISH_STATE_FILTER_OPTIONS: FilterOption = {
    key: 'state',
    label: 'Status objave',
    icon: <Megaphone className="size-4" />,
    options: [
        { value: '', label: 'Svi statusi' },
        {
            value: 'draft',
            label: 'Draft',
            icon: <Edit className="size-4" />,
        },
        {
            value: 'published',
            label: 'Objavljeno',
            icon: <Megaphone className="size-4" />,
        },
    ],
};

export function EntitiesFilters({
    operationOptions = [],
    selectedOperationIds = [],
}: {
    operationOptions?: DirectoryEntityFilterOption[];
    selectedOperationIds?: number[];
}) {
    return (
        <Row spacing={2} className="flex-wrap">
            <TableFilter
                filters={[
                    COMPLETION_FILTER_OPTIONS,
                    PUBLISH_STATE_FILTER_OPTIONS,
                ]}
                defaultValues={{
                    completion: '',
                    state: '',
                }}
                className="flex"
            />
            {operationOptions.length ? (
                <OperationMultiSelectFilter
                    options={operationOptions}
                    selectedOperationIds={selectedOperationIds}
                />
            ) : null}
        </Row>
    );
}

function OperationMultiSelectFilter({
    options,
    selectedOperationIds,
}: {
    options: DirectoryEntityFilterOption[];
    selectedOperationIds: number[];
}) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedValues = useMemo(
        () => new Set(selectedOperationIds.map((id) => id.toString())),
        [selectedOperationIds],
    );
    const selectedOptions = options.filter((option) =>
        selectedValues.has(option.value),
    );

    function updateSelected(nextValues: string[]) {
        const params = new URLSearchParams(searchParams.toString());
        if (nextValues.length) {
            params.set('operations', nextValues.join(','));
        } else {
            params.delete('operations');
        }

        const query = params.toString();
        router.push(`${pathname}${query ? `?${query}` : ''}` as Route);
    }

    function toggleValue(value: string) {
        const nextValues = selectedValues.has(value)
            ? Array.from(selectedValues).filter((item) => item !== value)
            : [...Array.from(selectedValues), value];

        updateSelected(nextValues);
    }

    return (
        <Row spacing={2} className="min-w-0 flex-wrap">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        startDecorator={<ListTodo className="size-4" />}
                        className="relative rounded-full"
                    >
                        Radnje
                        {selectedOptions.length ? (
                            <Chip
                                size="sm"
                                color="info"
                                className="ml-1 px-1.5 py-0.5 text-xs"
                            >
                                {selectedOptions.length}
                            </Chip>
                        ) : null}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80">
                    <DropdownMenuLabel>Prikaži radnje</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {options.map((option) => {
                        const selected = selectedValues.has(option.value);

                        return (
                            <DropdownMenuItem
                                key={option.value}
                                className="cursor-pointer justify-between gap-3"
                                onSelect={(event) => {
                                    event.preventDefault();
                                    toggleValue(option.value);
                                }}
                            >
                                <span className="min-w-0 truncate">
                                    {option.label}
                                </span>
                                <span
                                    className="flex size-4 shrink-0 items-center justify-center rounded-xs border border-primary"
                                    aria-hidden
                                >
                                    {selected ? (
                                        <Check className="size-3" />
                                    ) : null}
                                </span>
                            </DropdownMenuItem>
                        );
                    })}
                    {selectedOptions.length ? (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer text-destructive"
                                onClick={() => updateSelected([])}
                            >
                                <Close className="mr-2 size-4" />
                                Očisti filter radnji
                            </DropdownMenuItem>
                        </>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
            {selectedOptions.map((option) => (
                <Chip
                    key={option.value}
                    color="neutral"
                    size="sm"
                    onClick={() => toggleValue(option.value)}
                >
                    <Row spacing={2} className="min-w-0">
                        <ListTodo className="size-3 shrink-0" />
                        <span className="max-w-56 truncate">
                            {option.label}
                        </span>
                        <Close className="size-3 shrink-0" />
                    </Row>
                </Chip>
            ))}
        </Row>
    );
}
