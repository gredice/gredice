import type { AiAnalyticsOperationType } from '@gredice/storage';

export type { AiAnalyticsOperationType };

export const aiAnalyticsOperationTypeOptions: Array<{
    value: AiAnalyticsOperationType;
    label: string;
}> = [
    { value: 'raisedBedImageAnalysis', label: 'Analiza gredice' },
    { value: 'raisedBedFieldImageAnalysis', label: 'Analiza polja' },
    {
        value: 'raisedBedImagePlantStatusReview',
        label: 'Pregled statusa biljaka',
    },
];

const aiAnalyticsOperationTypeLabels = new Map(
    aiAnalyticsOperationTypeOptions.map((option) => [
        option.value,
        option.label,
    ]),
);

export function isAiAnalyticsOperationType(
    value: string | undefined,
): value is AiAnalyticsOperationType {
    return Boolean(
        value &&
            aiAnalyticsOperationTypeOptions.some(
                (option) => option.value === value,
            ),
    );
}

export function aiAnalyticsOperationTypeLabel(type: AiAnalyticsOperationType) {
    return aiAnalyticsOperationTypeLabels.get(type) ?? type;
}
