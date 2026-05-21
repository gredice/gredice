'use client';

import type { EntityStandardized } from '@gredice/storage';
import { FileText, Search } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getOperationLabel, getOperationSearchText } from './operationUtils';

interface OperationsHandbookProps {
    operationsData: EntityStandardized[];
}

export function OperationsHandbook({
    operationsData,
}: OperationsHandbookProps) {
    const [query, setQuery] = useState('');
    const normalizedQuery = query.trim().toLocaleLowerCase('hr-HR');
    const sortedOperations = useMemo(
        () =>
            [...operationsData].sort((left, right) =>
                getOperationLabel(left).localeCompare(
                    getOperationLabel(right),
                    undefined,
                    { numeric: true },
                ),
            ),
        [operationsData],
    );
    const filteredOperations = sortedOperations.filter(
        (operation) =>
            !normalizedQuery ||
            getOperationSearchText(operation).includes(normalizedQuery),
    );

    return (
        <Stack spacing={4}>
            <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-foreground">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Pretraži radnje"
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredOperations.map((operation) => {
                    const operationLabel = getOperationLabel(operation);

                    return (
                        <Link
                            key={operation.id}
                            href={`/operations/${operation.id}`}
                            aria-label={`Otvori detalje radnje ${operationLabel}`}
                            className="rounded-md border bg-white p-4 text-left text-foreground transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            <span className="flex items-center gap-2">
                                <FileText className="size-4 shrink-0 text-primary" />
                                <span className="font-medium">
                                    {operationLabel}
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </div>
            {filteredOperations.length === 0 && (
                <div className="rounded-md border bg-white p-4">
                    <Typography className="text-muted-foreground">
                        Nema radnji za prikaz.
                    </Typography>
                </div>
            )}
        </Stack>
    );
}
