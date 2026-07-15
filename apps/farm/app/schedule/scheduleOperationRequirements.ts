import type { EntityStandardized } from '@gredice/storage';

export type ScheduleOperationRequirementLevel =
    | 'none'
    | 'optional'
    | 'required'
    | 'unknown';

export type ScheduleOperationCompletionRequirements = {
    images: ScheduleOperationRequirementLevel;
    notes: ScheduleOperationRequirementLevel;
};

type ScheduleOperationRequirementSource = Pick<
    EntityStandardized,
    'conditions'
>;

function getRequirementLevel({
    enabled,
    metadataAvailable,
    operationData,
    required,
}: {
    enabled: boolean | undefined;
    metadataAvailable: boolean;
    operationData: ScheduleOperationRequirementSource | undefined;
    required: boolean | undefined;
}): ScheduleOperationRequirementLevel {
    if (!metadataAvailable || !operationData) {
        return 'unknown';
    }

    if (required) {
        return 'required';
    }

    return enabled ? 'optional' : 'none';
}

export function getScheduleOperationCompletionRequirements(
    operationData: ScheduleOperationRequirementSource | undefined,
    metadataAvailable = true,
): ScheduleOperationCompletionRequirements {
    return {
        images: getRequirementLevel({
            enabled: operationData?.conditions?.completionAttachImages,
            metadataAvailable,
            operationData,
            required: operationData?.conditions?.completionAttachImagesRequired,
        }),
        notes: getRequirementLevel({
            enabled: operationData?.conditions?.completionAttachNotes,
            metadataAvailable,
            operationData,
            required: operationData?.conditions?.completionAttachNotesRequired,
        }),
    };
}

export function assertScheduleOperationCompletionRequirementsAvailable(
    operationData: ScheduleOperationRequirementSource | undefined,
) {
    if (!operationData) {
        throw new Error(
            'Zahtjevi za dovršetak ove radnje trenutno nisu dostupni. Osvježi raspored ili se obrati administratoru.',
        );
    }

    return operationData;
}

export function isScheduleOperationRequirementVisible(
    level: ScheduleOperationRequirementLevel,
) {
    return level === 'optional' || level === 'required';
}

export function hasVisibleScheduleOperationCompletionRequirements(
    requirements: ScheduleOperationCompletionRequirements,
) {
    return (
        isScheduleOperationRequirementVisible(requirements.images) ||
        isScheduleOperationRequirementVisible(requirements.notes)
    );
}

export function assertScheduleOperationCompletionProof(
    requirements: ScheduleOperationCompletionRequirements,
    {
        imageUrls,
        notes,
    }: {
        imageUrls: string[] | undefined;
        notes: string | undefined;
    },
) {
    if (
        requirements.images === 'required' &&
        !imageUrls?.some((url) => url.trim().length > 0)
    ) {
        throw new Error('Fotografija je obavezna za završetak radnje.');
    }

    if (requirements.notes === 'required' && !notes?.trim()) {
        throw new Error('Napomena je obavezna za završetak radnje.');
    }
}
