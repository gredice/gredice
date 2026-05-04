import type { EntityStandardized } from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';

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

export function PlantsHandbook({ plantSortsData }: PlantsHandbookProps) {
    const sortedPlantSorts = [...plantSortsData].sort((left, right) =>
        (
            left.information?.label ??
            left.information?.name ??
            `${left.id}`
        ).localeCompare(
            right.information?.label ??
                right.information?.name ??
                `${right.id}`,
            undefined,
            { numeric: true },
        ),
    );

    return (
        <Stack spacing={2}>
            {sortedPlantSorts.map((plantSort) => {
                const plantValue: unknown = plantSort.information?.plant;
                const plantInformation = isRecord(plantValue)
                    ? plantValue
                    : null;
                const attributes =
                    plantInformation && isRecord(plantInformation.attributes)
                        ? plantInformation.attributes
                        : null;
                const calendar =
                    plantInformation && isRecord(plantInformation.calendar)
                        ? plantInformation.calendar
                        : null;

                return (
                    <Card key={plantSort.id}>
                        <CardHeader>
                            <CardTitle>
                                {plantSort.information?.label ??
                                    plantSort.information?.name ??
                                    `Sorta #${plantSort.id}`}
                            </CardTitle>
                        </CardHeader>
                        <CardContent noHeader>
                            <Stack spacing={1}>
                                {plantSort.information?.shortDescription && (
                                    <Typography className="text-muted-foreground">
                                        {plantSort.information.shortDescription}
                                    </Typography>
                                )}
                                {plantSort.information?.description && (
                                    <Typography level="body2">
                                        {plantSort.information.description}
                                    </Typography>
                                )}
                                {attributes && (
                                    <div className="rounded-md border bg-white p-3 space-y-2">
                                        <Typography level="body2" semiBold>
                                            Atributi biljke
                                        </Typography>
                                        {renderRecord(
                                            attributes,
                                            `attributes-${plantSort.id}`,
                                        )}
                                    </div>
                                )}
                                {calendar && (
                                    <div className="rounded-md border bg-white p-3 space-y-2">
                                        <Typography level="body2" semiBold>
                                            Kalendar uzgoja
                                        </Typography>
                                        {renderRecord(
                                            calendar,
                                            `calendar-${plantSort.id}`,
                                        )}
                                    </div>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
}
