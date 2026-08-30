import type { GardenStructureBuildSession } from '../useGameState';

export type GardenStructureConflictSessionIdentity = Readonly<{
    gardenId: number;
    operationId: string;
    structureId: string;
}>;

export function getMatchingGardenStructureConflictSession(
    session: GardenStructureBuildSession | null,
    identity: GardenStructureConflictSessionIdentity,
): GardenStructureBuildSession | null {
    if (!session) {
        return null;
    }
    const { editor } = session;
    if (
        editor.origin.kind !== 'saved-structure' ||
        editor.origin.gardenId !== identity.gardenId ||
        editor.origin.structureId !== identity.structureId ||
        editor.save.status !== 'conflict' ||
        editor.save.operationId !== identity.operationId
    ) {
        return null;
    }
    return session;
}
