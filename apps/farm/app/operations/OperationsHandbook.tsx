'use client';

import type { EntityStandardized } from '@gredice/storage';
import { FileText, Search } from '@signalco/ui-icons';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
import {
    formatMinutes,
    getOperationDurationMinutes,
} from '../schedule/scheduleShared';

interface OperationsHandbookProps {
    operationsData: EntityStandardized[];
}

function formatAttributeLabel(attributeName: string) {
    return attributeName
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (value) => value.toUpperCase());
}

function formatAttributeValue(value: unknown) {
    if (typeof value === 'boolean') {
        return value ? 'Da' : 'Ne';
    }

    if (typeof value === 'number') {
        return value.toLocaleString('hr-HR');
    }

    if (typeof value === 'string') {
        return value;
    }

    if (
        value &&
        typeof value === 'object' &&
        'information' in value &&
        value.information &&
        typeof value.information === 'object' &&
        'label' in value.information &&
        typeof value.information.label === 'string'
    ) {
        return value.information.label;
    }

    return null;
}

function getOperationLabel(operation: EntityStandardized) {
    return (
        operation.information?.label ??
        operation.information?.name ??
        `Operacija #${operation.id}`
    );
}

function getOperationSearchText(operation: EntityStandardized) {
    return [
        operation.information?.label,
        operation.information?.name,
        operation.information?.shortDescription,
        operation.information?.description,
        operation.information?.instructions,
    ]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLocaleLowerCase('hr-HR');
}

export function OperationsHandbook({
    operationsData,
}: OperationsHandbookProps) {
    const [query, setQuery] = useState('');
    const [selectedOperationId, setSelectedOperationId] = useState<
        number | null
    >(null);
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
    const selectedOperation =
        filteredOperations.find(
            (operation) => operation.id === selectedOperationId,
        ) ?? null;

    return (
        <Stack spacing={2}>
            <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-foreground">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setSelectedOperationId(null);
                    }}
                    placeholder="Pretraži operacije"
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredOperations.map((operation) => {
                    const selected = operation.id === selectedOperationId;

                    return (
                        <button
                            key={operation.id}
                            type="button"
                            onClick={() => setSelectedOperationId(operation.id)}
                            className={cx(
                                'rounded-md border bg-white p-4 text-left text-foreground transition-colors hover:border-primary',
                                selected && 'border-primary bg-tertiary',
                            )}
                        >
                            <span className="flex items-center gap-2">
                                <FileText className="size-4 shrink-0 text-primary" />
                                <span className="font-medium">
                                    {getOperationLabel(operation)}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
            {filteredOperations.length === 0 && (
                <div className="rounded-md border bg-white p-4">
                    <Typography className="text-muted-foreground">
                        Nema operacija za prikaz.
                    </Typography>
                </div>
            )}
            {selectedOperation && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {getOperationLabel(selectedOperation)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            {selectedOperation.information
                                ?.shortDescription && (
                                <Typography className="text-muted-foreground">
                                    {
                                        selectedOperation.information
                                            .shortDescription
                                    }
                                </Typography>
                            )}
                            {selectedOperation.information?.description && (
                                <Typography level="body2">
                                    {selectedOperation.information.description}
                                </Typography>
                            )}
                            {selectedOperation.information?.instructions && (
                                <div className="rounded-md border bg-muted/40 p-3">
                                    <Typography level="body2" semiBold>
                                        Upute
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="whitespace-pre-wrap"
                                    >
                                        {
                                            selectedOperation.information
                                                .instructions
                                        }
                                    </Typography>
                                </div>
                            )}
                            <div className="grid gap-2 text-sm sm:grid-cols-2">
                                <div className="rounded-md border bg-white p-3">
                                    <Typography level="body2" semiBold>
                                        Trajanje
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        {getOperationDurationMinutes(
                                            selectedOperation,
                                        ) > 0
                                            ? formatMinutes(
                                                  getOperationDurationMinutes(
                                                      selectedOperation,
                                                  ),
                                              )
                                            : 'Nije definirano'}
                                    </Typography>
                                </div>
                                <div className="rounded-md border bg-white p-3">
                                    <Typography level="body2" semiBold>
                                        Dokaz fotografijom
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        {!selectedOperation.conditions
                                            ?.completionAttachImages
                                            ? 'Nije potrebno'
                                            : selectedOperation.conditions
                                                    ?.completionAttachImagesRequired
                                              ? 'Obavezno priložiti fotografije'
                                              : 'Preporučeno priložiti fotografije'}
                                    </Typography>
                                </div>
                            </div>
                            {Object.entries(
                                selectedOperation.attributes ?? {},
                            ).filter(
                                ([attributeName, attributeValue]) =>
                                    attributeName !== 'duration' &&
                                    attributeValue !== null &&
                                    attributeValue !== undefined,
                            ).length > 0 && (
                                <div className="rounded-md border bg-white p-3">
                                    <Typography level="body2" semiBold>
                                        Dodatni detalji
                                    </Typography>
                                    <dl className="mt-2 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[1fr_2fr]">
                                        {Object.entries(
                                            selectedOperation.attributes ?? {},
                                        )
                                            .filter(
                                                ([
                                                    attributeName,
                                                    attributeValue,
                                                ]) =>
                                                    attributeName !==
                                                        'duration' &&
                                                    attributeValue !== null &&
                                                    attributeValue !==
                                                        undefined,
                                            )
                                            .map(
                                                ([
                                                    attributeName,
                                                    attributeValue,
                                                ]) => {
                                                    const formattedValue =
                                                        formatAttributeValue(
                                                            attributeValue,
                                                        );

                                                    if (!formattedValue) {
                                                        return null;
                                                    }

                                                    return (
                                                        <div
                                                            key={`${selectedOperation.id}-${attributeName}`}
                                                            className="contents"
                                                        >
                                                            <dt className="text-muted-foreground">
                                                                {formatAttributeLabel(
                                                                    attributeName,
                                                                )}
                                                            </dt>
                                                            <dd>
                                                                {formattedValue}
                                                            </dd>
                                                        </div>
                                                    );
                                                },
                                            )}
                                    </dl>
                                </div>
                            )}
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
}
