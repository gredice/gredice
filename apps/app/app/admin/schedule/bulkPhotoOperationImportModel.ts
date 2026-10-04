export const RAISED_BED_PHOTO_OPERATION_LABEL = 'Fotografiranje gredice';
export const MAX_PHOTOS_PER_OPERATION = 20;
export const MAX_BULK_PHOTO_OPERATION_COUNT = 200;

export type BulkPhotoOperationTarget = {
    operationId: number;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    physicalId: string;
};

export type BulkPhotoSelectionItem = {
    id: string;
    fileName: string;
};

export type BulkPhotoImportAssignment = {
    itemId: string;
    fileName: string;
    target: BulkPhotoOperationTarget;
};

export type BulkPhotoImportGroup = {
    target: BulkPhotoOperationTarget;
    assignments: BulkPhotoImportAssignment[];
    errorMessage?: string;
};

export type BulkPhotoImportError = {
    itemId: string;
    fileName: string;
    message: string;
};

function normalizeComparableValue(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('hr');
}

function filenameStem(fileName: string) {
    const trimmedFileName = fileName.trim();
    const extensionIndex = trimmedFileName.lastIndexOf('.');

    return extensionIndex > 0
        ? trimmedFileName.slice(0, extensionIndex).trim()
        : trimmedFileName;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesPhysicalId(filenameIdentifier: string, physicalId: string) {
    const normalizedPhysicalId = normalizeComparableValue(physicalId);
    const pattern = new RegExp(
        `^${escapeRegExp(normalizedPhysicalId)}(?:\\s*-\\s*[1-9]\\d*)?$`,
        'iu',
    );

    return pattern.test(filenameIdentifier);
}

export function isRaisedBedPhotoOperationLabel(value?: string | null) {
    return (
        normalizeComparableValue(value ?? '') ===
        normalizeComparableValue(RAISED_BED_PHOTO_OPERATION_LABEL)
    );
}

export function isRaisedBedPhotoOperationInformation(
    information:
        | { label?: string | null; name?: string | null }
        | null
        | undefined,
    stableOperationName: string,
) {
    return (
        information?.name === stableOperationName ||
        isRaisedBedPhotoOperationLabel(information?.label)
    );
}

function matchSelectionToTarget(
    item: BulkPhotoSelectionItem,
    targets: BulkPhotoOperationTarget[],
): { assignment: BulkPhotoImportAssignment } | { error: BulkPhotoImportError } {
    const stem = filenameStem(item.fileName);
    const prefixMatch = /^gr\s*(.+)$/iu.exec(stem);
    if (!prefixMatch) {
        return {
            error: {
                itemId: item.id,
                fileName: item.fileName,
                message: 'Naziv mora početi s "Gr" i fizičkim ID-om gredice.',
            },
        };
    }

    const filenameIdentifier = normalizeComparableValue(prefixMatch[1]);
    const matchingTargets = targets.filter((target) =>
        matchesPhysicalId(filenameIdentifier, target.physicalId),
    );

    if (matchingTargets.length === 0) {
        return {
            error: {
                itemId: item.id,
                fileName: item.fileName,
                message:
                    'Naziv ne odgovara nijednoj zakazanoj radnji fotografiranja za ovaj dan.',
            },
        };
    }

    const matchingPhysicalIds = new Set(
        matchingTargets.map((target) =>
            normalizeComparableValue(target.physicalId),
        ),
    );
    if (matchingPhysicalIds.size > 1) {
        return {
            error: {
                itemId: item.id,
                fileName: item.fileName,
                message:
                    'Naziv odgovara više fizičkih ID-ova. Preimenujte sliku tako da veza bude jednoznačna.',
            },
        };
    }

    if (matchingTargets.length > 1) {
        return {
            error: {
                itemId: item.id,
                fileName: item.fileName,
                message: `Za gredicu ${matchingTargets[0]?.physicalId ?? ''} postoji više zakazanih radnji fotografiranja.`,
            },
        };
    }

    const target = matchingTargets[0];
    if (!target) {
        return {
            error: {
                itemId: item.id,
                fileName: item.fileName,
                message: 'Radnja fotografiranja nije pronađena.',
            },
        };
    }

    return {
        assignment: {
            itemId: item.id,
            fileName: item.fileName,
            target,
        },
    };
}

export function buildBulkPhotoImportPreview(
    items: BulkPhotoSelectionItem[],
    targets: BulkPhotoOperationTarget[],
) {
    const assignments: BulkPhotoImportAssignment[] = [];
    const errors: BulkPhotoImportError[] = [];

    for (const item of items) {
        const match = matchSelectionToTarget(item, targets);
        if ('assignment' in match) {
            assignments.push(match.assignment);
        } else {
            errors.push(match.error);
        }
    }

    const groupsByOperationId = new Map<number, BulkPhotoImportGroup>();
    for (const assignment of assignments) {
        const existingGroup = groupsByOperationId.get(
            assignment.target.operationId,
        );
        if (existingGroup) {
            existingGroup.assignments.push(assignment);
        } else {
            groupsByOperationId.set(assignment.target.operationId, {
                target: assignment.target,
                assignments: [assignment],
            });
        }
    }

    const groups = [...groupsByOperationId.values()]
        .map((group) => ({
            ...group,
            errorMessage:
                group.assignments.length > MAX_PHOTOS_PER_OPERATION
                    ? `Jedna radnja može imati najviše ${MAX_PHOTOS_PER_OPERATION} slika.`
                    : undefined,
        }))
        .sort((left, right) =>
            left.target.physicalId.localeCompare(
                right.target.physicalId,
                undefined,
                { numeric: true },
            ),
        );

    return {
        assignments,
        errors,
        groups,
        batchErrorMessage:
            groups.length > MAX_BULK_PHOTO_OPERATION_COUNT
                ? `Odjednom se može završiti najviše ${MAX_BULK_PHOTO_OPERATION_COUNT} radnji.`
                : undefined,
        canSubmit:
            items.length > 0 &&
            errors.length === 0 &&
            groups.length > 0 &&
            groups.length <= MAX_BULK_PHOTO_OPERATION_COUNT &&
            groups.every((group) => !group.errorMessage),
    };
}
