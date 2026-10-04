import type { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { GardenOperationItem } from '../../hooks/useGardenOperations';

export type RaisedBedAiHistoryEntry = {
    id: number;
    description: string | undefined;
    timestamp: Date;
    imageUrls?: string[] | null;
    isMarkdown?: boolean;
};

export function buildFieldPositionById(
    garden: ReturnType<typeof useCurrentGarden>['data'],
) {
    return new Map(
        (garden?.raisedBeds ?? []).flatMap((raisedBed) =>
            raisedBed.fields.map(
                (field) => [field.id, field.positionIndex] as const,
            ),
        ),
    );
}

export function buildFieldPlantSortIdById(
    garden: ReturnType<typeof useCurrentGarden>['data'],
) {
    return new Map(
        (garden?.raisedBeds ?? []).flatMap((raisedBed) =>
            raisedBed.fields.flatMap((field) =>
                typeof field.plantSortId === 'number'
                    ? [[field.id, field.plantSortId] as const]
                    : [],
            ),
        ),
    );
}

export function getAiHistoryForOperation({
    imageUrls,
    entries,
}: {
    imageUrls: string[];
    entries: RaisedBedAiHistoryEntry[] | undefined;
}) {
    if (!imageUrls.length || !entries?.length) {
        return undefined;
    }

    const relatedEntries = entries.filter((entry) => {
        if (!entry.isMarkdown || !entry.imageUrls?.length) {
            return false;
        }

        return imageUrls.some((imageUrl) =>
            entry.imageUrls?.includes(imageUrl),
        );
    });

    return relatedEntries.length
        ? relatedEntries.sort(
              (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
          )
        : undefined;
}

export function getOperationReferenceDate(operation: GardenOperationItem) {
    return (
        operation.completedAt ??
        operation.verifiedAt ??
        operation.canceledAt ??
        operation.scheduledAt ??
        operation.scheduledDate ??
        operation.createdAt
    );
}
