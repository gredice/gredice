import type { GardenStructureEditorOrigin } from './editor';

export function resolveGardenStructureMutationConflictRevision({
    code,
    currentRevision,
    originKind,
}: Readonly<{
    code: string;
    currentRevision: number | null;
    originKind: GardenStructureEditorOrigin['kind'];
}>): number | null | undefined {
    if (originKind !== 'saved-structure') {
        return undefined;
    }
    if (code === 'REVISION_CONFLICT') {
        return currentRevision;
    }
    if (code === 'STRUCTURE_NOT_FOUND') {
        return null;
    }
    return undefined;
}
