import type { GardenStructureEditorOrigin } from './gardenStructureEditorTypes';

export const gardenStructureEditorRecoveryStorageVersion = 1;

const recoveryStoragePrefix = 'gredice:garden-structure-editor';

function encodeStorageSegment(value: string | number) {
    return encodeURIComponent(value.toString());
}

export function getGardenStructureEditorRecoveryStorageKey(
    origin:
        | GardenStructureEditorOrigin
        | Readonly<{
              gardenId: number;
              kind: 'new-draft';
          }>,
) {
    const scope =
        origin.kind === 'new-draft'
            ? 'new'
            : `structure:${encodeStorageSegment(origin.structureId)}`;
    return `${recoveryStoragePrefix}:v${gardenStructureEditorRecoveryStorageVersion.toString()}:garden:${encodeStorageSegment(origin.gardenId)}:${scope}`;
}

export function readGardenStructureEditorRecoveryStorage(
    storage: Pick<Storage, 'getItem' | 'removeItem'>,
    key: string,
) {
    try {
        return storage.getItem(key);
    } catch {
        try {
            storage.removeItem(key);
        } catch {
            // Storage can be unavailable in privacy modes. Recovery remains a
            // best-effort safety net and never changes the server save state.
        }
        return null;
    }
}

export function writeGardenStructureEditorRecoveryStorage(
    storage: Pick<Storage, 'removeItem' | 'setItem'>,
    key: string,
    serialized: string | null,
) {
    try {
        if (serialized === null) {
            storage.removeItem(key);
        } else {
            storage.setItem(key, serialized);
        }
        return true;
    } catch {
        return false;
    }
}
