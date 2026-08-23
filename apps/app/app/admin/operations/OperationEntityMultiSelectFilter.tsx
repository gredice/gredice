'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Check, Close, ListTodo } from '@gredice/ui/icons';
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
import { operationsListOperationEntityParam } from './operationsListQuery';
import type { OperationEntityFilterOption } from './operationsListTypes';

export function OperationEntityMultiSelectFilter({
    options,
    selectedOperationEntityIds,
}: {
    options: OperationEntityFilterOption[];
    selectedOperationEntityIds: number[];
}) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedValues = useMemo(
        () => new Set(selectedOperationEntityIds.map((id) => id.toString())),
        [selectedOperationEntityIds],
    );
    const optionByValue = useMemo(
        () => new Map(options.map((option) => [option.value, option])),
        [options],
    );
    const selectedOptions = selectedOperationEntityIds.map((id) => {
        const value = id.toString();
        return (
            optionByValue.get(value) ?? {
                value,
                label: `Radnja ${value}`,
            }
        );
    });

    function updateSelected(nextValues: string[]) {
        const params = new URLSearchParams(searchParams.toString());
        if (nextValues.length) {
            params.set(
                operationsListOperationEntityParam,
                nextValues.join(','),
            );
        } else {
            params.delete(operationsListOperationEntityParam);
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
                        Vrsta radnje
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
                    <DropdownMenuLabel>Prikaži vrste radnji</DropdownMenuLabel>
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
                                Očisti filter vrsta
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
