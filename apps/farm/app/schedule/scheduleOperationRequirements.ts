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

function getRequirementLevel({
    enabled,
    metadataAvailable,
    operationData,
    required,
}: {
    enabled: boolean | undefined;
    metadataAvailable: boolean;
    operationData: EntityStandardized | undefined;
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
    operationData: EntityStandardized | undefined,
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

export function isScheduleOperationRequirementVisible(
    level: ScheduleOperationRequirementLevel,
) {
    return level === 'optional' || level === 'required';
}
