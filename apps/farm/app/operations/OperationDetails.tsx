import type { EntityStandardized } from '@gredice/storage';
import { Card, CardContent } from '@gredice/ui/Card';
import {
    Check,
    FileInput,
    FileText,
    History,
    Info,
    Layers,
    ListTodo,
    Paperclip,
    Security,
    Sprout,
    Timer,
} from '@gredice/ui/icons';
import { Markdown } from '@gredice/ui/Markdown';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
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

const manualMarkdownClassName =
    'text-base leading-8 text-foreground prose-base prose-p:text-base prose-p:leading-8 prose-p:text-foreground prose-li:text-base prose-li:leading-8 prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary prose-ul:my-3 prose-ol:my-3 prose-li:my-1';

const attributeIconByName: Record<string, typeof Info> = {
    application: Layers,
    frequency: History,
    deliverable: Check,
    internal: Security,
    printLabel: FileInput,
    stage: Sprout,
};

function hasFormattedValue(
    attribute: FormattedAttribute,
): attribute is { attributeName: string; formattedValue: string } {
    return attribute.formattedValue !== null;
}

function getAttributeIcon(attributeName: string) {
    return attributeIconByName[attributeName] ?? Info;
}

function DetailCard({
    children,
    className,
    icon: Icon,
    title,
}: {
    children: ReactNode;
    className?: string;
    icon: typeof Info;
    title: string;
}) {
    return (
        <Card className={className}>
            <CardContent noHeader className="p-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-5" />
                    </span>
                    <Stack spacing={1} className="min-w-0 flex-1">
                        <Typography
                            level="body1"
                            semiBold
                            className="text-foreground"
                        >
                            {title}
                        </Typography>
                        {children}
                    </Stack>
                </div>
            </CardContent>
        </Card>
    );
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
            formattedValue: formatAttributeValue(attributeValue, attributeName),
        }))
        .filter(hasFormattedValue);

    return (
        <Stack spacing={3}>
            {operation.information?.description && (
                <DetailCard title="Opis" icon={FileText}>
                    <Markdown
                        className={`${manualMarkdownClassName} prose-p:first:mt-0 prose-p:last:mb-0`}
                    >
                        {operation.information.description}
                    </Markdown>
                </DetailCard>
            )}
            {operation.information?.instructions && (
                <DetailCard title="Upute" icon={ListTodo}>
                    <Markdown
                        className={`${manualMarkdownClassName} prose-p:first:mt-0 prose-p:last:mb-0`}
                    >
                        {operation.information.instructions}
                    </Markdown>
                </DetailCard>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard title="Trajanje" icon={Timer}>
                    <Typography level="body1" className="text-foreground">
                        {durationMinutes > 0
                            ? formatMinutes(durationMinutes)
                            : 'Nije definirano'}
                    </Typography>
                </DetailCard>
                <DetailCard title="Dokaz fotografijom" icon={Paperclip}>
                    <Typography level="body1" className="text-foreground">
                        {!operation.conditions?.completionAttachImages
                            ? 'Nije potrebno'
                            : operation.conditions
                                    ?.completionAttachImagesRequired
                              ? 'Obavezno priložiti fotografije'
                              : 'Preporučeno priložiti fotografije'}
                    </Typography>
                </DetailCard>
            </div>
            {attributes.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {attributes.map(({ attributeName, formattedValue }) => (
                        <DetailCard
                            key={`${operation.id}-${attributeName}`}
                            title={formatAttributeLabel(attributeName)}
                            icon={getAttributeIcon(attributeName)}
                        >
                            <Typography
                                level="body1"
                                className="text-foreground"
                            >
                                {formattedValue}
                            </Typography>
                        </DetailCard>
                    ))}
                </div>
            )}
        </Stack>
    );
}
