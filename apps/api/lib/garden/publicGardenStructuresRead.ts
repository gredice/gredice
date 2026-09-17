import {
    listGardenStructures,
    withTransientDatabaseReadRetry,
} from '@gredice/storage';

type ListGardenStructures = typeof listGardenStructures;

/** Caller must establish that the garden is public before reading its structures. */
export function listPublicGardenStructures(
    gardenId: number,
    readStructures: ListGardenStructures = listGardenStructures,
) {
    return withTransientDatabaseReadRetry(() => readStructures(gardenId), {
        operation: 'list-public-garden-structures',
        context: { gardenId },
    });
}
