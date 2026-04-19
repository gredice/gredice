import type { EntityStandardized } from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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

export function OperationsHandbook({
    operationsData,
}: OperationsHandbookProps) {
    const sortedOperations = [...operationsData].sort((left, right) =>
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
            {sortedOperations.map((operation) => {
                const durationMinutes = getOperationDurationMinutes(operation);
                const attributes = Object.entries(
                    operation.attributes ?? {},
                ).filter(
                    ([attributeName, attributeValue]) =>
                        attributeName !== 'duration' &&
                        attributeValue !== null &&
                        attributeValue !== undefined,
                );
                const attachImages =
                    operation.conditions?.completionAttachImages;
                const attachImagesRequired =
                    operation.conditions?.completionAttachImagesRequired;

                return (
                    <Card key={operation.id}>
                        <CardHeader>
                            <CardTitle>
                                {operation.information?.label ??
                                    operation.information?.name ??
                                    `Operacija #${operation.id}`}
                            </CardTitle>
                        </CardHeader>
                        <CardContent noHeader>
                            <Stack spacing={1}>
                                {operation.information?.shortDescription && (
                                    <Typography className="text-muted-foreground">
                                        {operation.information.shortDescription}
                                    </Typography>
                                )}
                                {operation.information?.description && (
                                    <Typography level="body2">
                                        {operation.information.description}
                                    </Typography>
                                )}
                                {operation.information?.instructions && (
                                    <div className="rounded-md border bg-muted/40 p-3">
                                        <Typography level="body2" semiBold>
                                            Upute
                                        </Typography>
                                        <Typography
                                            level="body2"
                                            className="whitespace-pre-wrap"
                                        >
                                            {operation.information.instructions}
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
                                            {durationMinutes > 0
                                                ? formatMinutes(durationMinutes)
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
                                            {!attachImages
                                                ? 'Nije potrebno'
                                                : attachImagesRequired
                                                  ? 'Obavezno priložiti fotografije'
                                                  : 'Preporučeno priložiti fotografije'}
                                        </Typography>
                                    </div>
                                </div>
                                {attributes.length > 0 && (
                                    <div className="rounded-md border bg-white p-3">
                                        <Typography level="body2" semiBold>
                                            Dodatni detalji
                                        </Typography>
                                        <dl className="mt-2 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[1fr_2fr]">
                                            {attributes.map(
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
                                                            key={`${operation.id}-${attributeName}`}
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
                );
            })}
        </Stack>
    );
}
