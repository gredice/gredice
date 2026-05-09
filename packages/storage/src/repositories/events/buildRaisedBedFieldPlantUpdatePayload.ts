import { normalizeAssignedUserIds } from './normalizeAssignedUserIds';
import type { RaisedBedFieldPlantUpdatePayload } from './types';

export function buildRaisedBedFieldPlantUpdatePayload(
    status: string,
    assignedUserIds?: string[],
): RaisedBedFieldPlantUpdatePayload {
    const normalizedAssignedUserIds = normalizeAssignedUserIds(
        assignedUserIds,
        undefined,
    );

    return normalizedAssignedUserIds.length > 0
        ? {
              status,
              assignedUserIds: normalizedAssignedUserIds,
          }
        : { status };
}
