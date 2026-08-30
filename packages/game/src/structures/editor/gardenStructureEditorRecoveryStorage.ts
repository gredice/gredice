import {
    gardenStructureMaxActivePerGarden,
    gardenStructureMaxIdentifierLength,
} from '@gredice/js/gardenStructures';
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
          }>
        | Readonly<{
              gardenId: number;
              kind: 'saved-structure';
              structureId: string;
          }>,
) {
    const scope =
        origin.kind === 'new-draft'
            ? 'new'
            : `structure:${encodeStorageSegment(origin.structureId)}`;
    return `${recoveryStoragePrefix}:v${gardenStructureEditorRecoveryStorageVersion.toString()}:garden:${encodeStorageSegment(origin.gardenId)}:${scope}`;
}

function getGardenStructureEditorDemolitionRecoveryPointerKey(
    gardenId: number,
) {
    return `${recoveryStoragePrefix}:v${gardenStructureEditorRecoveryStorageVersion.toString()}:garden:${encodeStorageSegment(gardenId)}:demolition`;
}

function getGardenStructureEditorSavedRecoveryIndexKey(gardenId: number) {
    return `${recoveryStoragePrefix}:v${gardenStructureEditorRecoveryStorageVersion.toString()}:garden:${encodeStorageSegment(gardenId)}:saved-index`;
}

function isBoundedIdentifier(value: string) {
    return (
        value.length > 0 &&
        value.length <= gardenStructureMaxIdentifierLength &&
        value.trim() === value
    );
}

export function readGardenStructureEditorDemolitionRecoveryPointer(
    storage: Pick<Storage, 'getItem' | 'removeItem'>,
    gardenId: number,
) {
    const key = getGardenStructureEditorDemolitionRecoveryPointerKey(gardenId);
    try {
        const structureId = storage.getItem(key);
        if (structureId === null || isBoundedIdentifier(structureId)) {
            return structureId;
        }
        storage.removeItem(key);
    } catch {
        try {
            storage.removeItem(key);
        } catch {
            // Storage may be unavailable. The caller treats this as missing
            // durable recovery and keeps the user in the active editor.
        }
    }
    return null;
}

export function writeGardenStructureEditorDemolitionRecoveryPointer(
    storage: Pick<Storage, 'removeItem' | 'setItem'>,
    gardenId: number,
    structureId: string | null,
) {
    if (structureId !== null && !isBoundedIdentifier(structureId)) {
        return false;
    }
    const key = getGardenStructureEditorDemolitionRecoveryPointerKey(gardenId);
    try {
        if (structureId === null) {
            storage.removeItem(key);
        } else {
            storage.setItem(key, structureId);
        }
        return true;
    } catch {
        return false;
    }
}

export function readGardenStructureEditorSavedRecoveryIndex(
    storage: Pick<Storage, 'getItem' | 'removeItem'>,
    gardenId: number,
) {
    const key = getGardenStructureEditorSavedRecoveryIndexKey(gardenId);
    try {
        const serialized = storage.getItem(key);
        if (serialized === null) {
            return [];
        }
        const parsed: unknown = JSON.parse(serialized);
        const identifiers = Array.isArray(parsed)
            ? parsed.filter(
                  (value): value is string =>
                      typeof value === 'string' && isBoundedIdentifier(value),
              )
            : [];
        if (
            Array.isArray(parsed) &&
            parsed.length <= gardenStructureMaxActivePerGarden &&
            identifiers.length === parsed.length &&
            new Set(identifiers).size === identifiers.length
        ) {
            return identifiers;
        }
        storage.removeItem(key);
    } catch {
        try {
            storage.removeItem(key);
        } catch {
            // Storage may be unavailable. The caller treats the index as empty
            // and keeps any active editor open until its draft is safe.
        }
    }
    return [];
}

export function writeGardenStructureEditorSavedRecoveryIndex(
    storage: Pick<Storage, 'removeItem' | 'setItem'>,
    gardenId: number,
    structureIds: readonly string[],
) {
    if (
        structureIds.length > gardenStructureMaxActivePerGarden ||
        structureIds.some((structureId) => !isBoundedIdentifier(structureId)) ||
        new Set(structureIds).size !== structureIds.length
    ) {
        return false;
    }
    const key = getGardenStructureEditorSavedRecoveryIndexKey(gardenId);
    try {
        if (structureIds.length === 0) {
            storage.removeItem(key);
        } else {
            storage.setItem(key, JSON.stringify(structureIds));
        }
        return true;
    } catch {
        return false;
    }
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
