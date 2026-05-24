'use client';

import type { EntityStandardized } from '@gredice/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Search, Sprout } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useMemo, useState } from 'react';

interface PlantsHandbookProps {
    plantSortsData: EntityStandardized[];
}

function formatLabel(value: string) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function renderValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 'Da' : 'Ne';
    if (typeof value === 'number') return value.toLocaleString('hr-HR');
    if (typeof value === 'string') return value;

    if (isRecord(value) && typeof value.label === 'string') {
        return value.label;
    }

    return null;
}

function renderPeriod(record: Record<string, unknown>) {
    const start = renderValue(record.start);
    const end = renderValue(record.end);

    if (!start && !end) return null;
    if (start && end) return start === end ? start : `${start} - ${end}`;

    return start ?? end;
}

function renderArray(values: unknown[], keyPrefix: string): ReactNode | null {
    const renderedItems = values.map((item, index) => {
        const itemKey = `${keyPrefix}-${index}`;
        const formattedValue = renderValue(item);

        if (formattedValue) {
            return <li key={itemKey}>{formattedValue}</li>;
        }

        if (Array.isArray(item)) {
            const nestedArray = renderArray(item, itemKey);
            if (!nestedArray) return null;

            return <li key={itemKey}>{nestedArray}</li>;
        }

        if (isRecord(item)) {
            const period = renderPeriod(item);
            if (period) return <li key={itemKey}>{period}</li>;

            const nestedRecord = renderRecord(item, itemKey);
            if (!nestedRecord) return null;

            return <li key={itemKey}>{nestedRecord}</li>;
        }

        return null;
    });

    if (renderedItems.every((item) => item === null)) return null;

    return <ul className="list-disc space-y-1 pl-4">{renderedItems}</ul>;
}

function renderRecord(record: Record<string, unknown>, keyPrefix: string) {
    const entries = Object.entries(record).filter(
        ([, recordValue]) => recordValue !== null && recordValue !== undefined,
    );
    if (entries.length === 0) return null;

    return (
        <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[1fr_2fr]">
            {entries.map(([entryKey, entryValue]) => {
                if (isRecord(entryValue)) {
                    const nestedRecord = renderRecord(
                        entryValue,
                        `${keyPrefix}-${entryKey}`,
                    );
                    if (!nestedRecord) return null;

                    return (
                        <div
                            key={`${keyPrefix}-${entryKey}`}
                            className="sm:col-span-2 space-y-2"
                        >
                            <Typography level="body2" semiBold>
                                {formatLabel(entryKey)}
                            </Typography>
                            {nestedRecord}
                        </div>
                    );
                }

                if (Array.isArray(entryValue)) {
                    const nestedArray = renderArray(
                        entryValue,
                        `${keyPrefix}-${entryKey}`,
                    );
                    if (!nestedArray) return null;

                    return (
                        <div
                            key={`${keyPrefix}-${entryKey}`}
                            className="contents"
                        >
                            <dt className="text-muted-foreground">
                                {formatLabel(entryKey)}
                            </dt>
                            <dd>{nestedArray}</dd>
                        </div>
                    );
                }

                const formattedValue = renderValue(entryValue);
                if (!formattedValue) return null;

                return (
                    <div key={`${keyPrefix}-${entryKey}`} className="contents">
                        <dt className="text-muted-foreground">
                            {formatLabel(entryKey)}
                        </dt>
                        <dd>{formattedValue}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

function getPlantSortLabel(plantSort: EntityStandardized) {
    return (
        plantSort.information?.label ??
        plantSort.information?.name ??
        `Sorta #${plantSort.id}`
    );
}

function normalizePlantSearchText(value: string | null | undefined) {
    return (value ?? '')
        .replace(/[Đđ]/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('hr-HR')
        .trim();
}

function getPlantSortSearchText(plantSort: EntityStandardized) {
    const plantInformation = plantSort.information?.plant?.information;

    return [
        plantSort.information?.label,
        plantSort.information?.name,
        plantSort.information?.shortDescription,
        plantSort.information?.description,
        ...(plantSort.information?.alternativeName ?? []),
        plantInformation?.label,
        plantInformation?.name,
        plantInformation?.shortDescription,
        plantInformation?.description,
        ...(plantInformation?.alternativeName ?? []),
    ]
        .filter((value) => typeof value === 'string')
        .map((value) => normalizePlantSearchText(value))
        .join(' ');
}

export function PlantsHandbook({ plantSortsData }: PlantsHandbookProps) {
    const [query, setQuery] = useState('');
    const [selectedPlantSortId, setSelectedPlantSortId] = useState<
        number | null
    >(null);
    const normalizedQuery = normalizePlantSearchText(query);
    const sortedPlantSorts = useMemo(
        () =>
            [...plantSortsData].sort((left, right) =>
                getPlantSortLabel(left).localeCompare(
                    getPlantSortLabel(right),
                    undefined,
                    { numeric: true },
                ),
            ),
        [plantSortsData],
    );
    const filteredPlantSorts = sortedPlantSorts.filter(
        (plantSort) =>
            !normalizedQuery ||
            getPlantSortSearchText(plantSort).includes(normalizedQuery),
    );
    const selectedPlantSort =
        filteredPlantSorts.find(
            (plantSort) => plantSort.id === selectedPlantSortId,
        ) ?? null;

    return (
        <Stack spacing={4}>
            <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-foreground">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setSelectedPlantSortId(null);
                    }}
                    placeholder="Pretraži biljke"
                    className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
                />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPlantSorts.map((plantSort) => {
                    const selected = plantSort.id === selectedPlantSortId;

                    return (
                        <button
                            key={plantSort.id}
                            type="button"
                            onClick={() => setSelectedPlantSortId(plantSort.id)}
                            className={cx(
                                'rounded-md border bg-white p-4 text-left text-foreground transition-colors hover:border-primary',
                                selected && 'border-primary bg-tertiary',
                            )}
                        >
                            <span className="flex items-center gap-3">
                                <PlantOrSortImage
                                    plantSort={plantSort}
                                    width={36}
                                    height={36}
                                    className="size-9 rounded-md object-cover"
                                />
                                <span className="font-medium">
                                    {getPlantSortLabel(plantSort)}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
            {filteredPlantSorts.length === 0 && (
                <div className="rounded-md border bg-white p-4">
                    <Typography className="text-muted-foreground">
                        Nema biljaka za prikaz.
                    </Typography>
                </div>
            )}
            {selectedPlantSort && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <span className="flex items-center gap-2">
                                <Sprout className="size-4 text-primary" />
                                {getPlantSortLabel(selectedPlantSort)}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent noHeader>
                        <Stack spacing={2}>
                            {selectedPlantSort.information
                                ?.shortDescription && (
                                <Typography className="text-muted-foreground">
                                    {
                                        selectedPlantSort.information
                                            .shortDescription
                                    }
                                </Typography>
                            )}
                            {selectedPlantSort.information?.description && (
                                <Typography level="body2">
                                    {selectedPlantSort.information.description}
                                </Typography>
                            )}
                            {(() => {
                                const plantValue: unknown =
                                    selectedPlantSort.information?.plant;
                                const plantInformation = isRecord(plantValue)
                                    ? plantValue
                                    : null;
                                const attributes =
                                    plantInformation &&
                                    isRecord(plantInformation.attributes)
                                        ? plantInformation.attributes
                                        : null;
                                const calendar =
                                    plantInformation &&
                                    isRecord(plantInformation.calendar)
                                        ? plantInformation.calendar
                                        : null;

                                return (
                                    <>
                                        {attributes && (
                                            <div className="rounded-md border bg-white p-3 space-y-2">
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                >
                                                    Atributi biljke
                                                </Typography>
                                                {renderRecord(
                                                    attributes,
                                                    `attributes-${selectedPlantSort.id}`,
                                                )}
                                            </div>
                                        )}
                                        {calendar && (
                                            <div className="rounded-md border bg-white p-3 space-y-2">
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                >
                                                    Kalendar uzgoja
                                                </Typography>
                                                {renderRecord(
                                                    calendar,
                                                    `calendar-${selectedPlantSort.id}`,
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
}
