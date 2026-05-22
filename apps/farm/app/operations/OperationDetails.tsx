import type { EntityStandardized } from '@gredice/storage';
import { Card, CardContent } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    formatMinutes,
    getOperationDurationMinutes,
} from '../schedule/scheduleShared';
import { formatAttributeLabel, formatAttributeValue } from './operationUtils';

interface OperationDetailsProps {
    operation: EntityStandardized;
}

interface FormattedAttribute {
    attributeName: string;
    formattedValue: string | null;
}

function hasFormattedValue(
    attribute: FormattedAttribute,
): attribute is { attributeName: string; formattedValue: string } {
    return attribute.formattedValue !== null;
}

export function OperationDetails({ operation }: OperationDetailsProps) {
    const durationMinutes = getOperationDurationMinutes(operation);
    const attributes = Object.entries(operation.attributes ?? {})
        .filter(
            ([attributeName, attributeValue]) =>
                attributeName !== 'duration' &&
                attributeValue !== null &&
                attributeValue !== undefined,
        )
        .map(([attributeName, attributeValue]) => ({
            attributeName,
            formattedValue: formatAttributeValue(attributeValue),
        }))
        .filter(hasFormattedValue);

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
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
                                {!operation.conditions?.completionAttachImages
                                    ? 'Nije potrebno'
                                    : operation.conditions
                                            ?.completionAttachImagesRequired
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
                                    ({ attributeName, formattedValue }) => (
                                        <div
                                            key={`${operation.id}-${attributeName}`}
                                            className="contents"
                                        >
                                            <dt className="text-muted-foreground">
                                                {formatAttributeLabel(
                                                    attributeName,
                                                )}
                                            </dt>
                                            <dd>{formattedValue}</dd>
                                        </div>
                                    ),
                                )}
                            </dl>
                        </div>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
