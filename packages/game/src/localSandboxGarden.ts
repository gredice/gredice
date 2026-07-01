import {
    defaultGameBackgroundPaletteKey,
    type GameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';
import { Vector3 } from 'three';
import type { Block } from './types/Block';
import type { Stack } from './types/Stack';

export const localSandboxGardenId = 0;
export const defaultLocalSandboxStorageKey = 'gredice.debug.sandbox.garden.v1';

export type LocalSandboxGarden = {
    id: number;
    name: string;
    isSandbox: true;
    isPublic: false;
    backgroundPalette: GameBackgroundPaletteKey;
    stacks: Stack[];
    location: {
        lat: number;
        lon: number;
    };
    raisedBeds: [];
};

type StoredLocalSandboxGarden = {
    backgroundPalette?: unknown;
    stacks?: Array<{
        position?: {
            x?: unknown;
            z?: unknown;
        };
        blocks?: unknown;
    }>;
};

type LocalSandboxGardenOptions = {
    backgroundPalette?: GameBackgroundPaletteKey;
    name?: string;
    stacks?: Stack[];
};

function createDefaultLocalSandboxStacks(): Stack[] {
    const stacks: Stack[] = [];

    for (let x = -2; x <= 2; x += 1) {
        for (let z = -2; z <= 2; z += 1) {
            stacks.push({
                position: new Vector3(x, 0, z),
                blocks: [
                    {
                        id: `local-ground:${x}:${z}`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            });
        }
    }

    return stacks;
}

function cloneSandboxStacks(stacks: Stack[]): Stack[] {
    return stacks.map((stack) => ({
        position: stack.position.clone(),
        blocks: stack.blocks.map((block) => ({ ...block })),
    }));
}

function resolveDefaultLocalSandboxStacks(stacks: Stack[] | undefined) {
    return stacks?.length
        ? cloneSandboxStacks(stacks)
        : createDefaultLocalSandboxStacks();
}

export function createDefaultLocalSandboxGarden(
    options: LocalSandboxGardenOptions = {},
): LocalSandboxGarden {
    return {
        id: localSandboxGardenId,
        name: options.name ?? 'Debug sandbox',
        isSandbox: true,
        isPublic: false,
        backgroundPalette:
            options.backgroundPalette ?? defaultGameBackgroundPaletteKey,
        stacks: resolveDefaultLocalSandboxStacks(options.stacks),
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    };
}

function isStoredBlock(value: unknown): value is Partial<Block> {
    return typeof value === 'object' && value !== null;
}

function normalizeStoredBlocks(blocks: unknown): Block[] {
    if (!Array.isArray(blocks)) {
        return [];
    }

    return blocks.flatMap((candidate) => {
        if (!isStoredBlock(candidate)) {
            return [];
        }

        if (
            typeof candidate.id !== 'string' ||
            typeof candidate.name !== 'string'
        ) {
            return [];
        }

        return [
            {
                id: candidate.id,
                name: candidate.name,
                rotation:
                    typeof candidate.rotation === 'number'
                        ? candidate.rotation
                        : 0,
                variant:
                    typeof candidate.variant === 'number' ||
                    candidate.variant === null
                        ? candidate.variant
                        : undefined,
            },
        ];
    });
}

function normalizeStoredGarden(
    storedGarden: StoredLocalSandboxGarden,
    options: LocalSandboxGardenOptions = {},
): LocalSandboxGarden {
    const stacks =
        storedGarden.stacks?.flatMap((stack) => {
            const x = stack.position?.x;
            const z = stack.position?.z;
            if (typeof x !== 'number' || typeof z !== 'number') {
                return [];
            }

            return [
                {
                    position: new Vector3(x, 0, z),
                    blocks: normalizeStoredBlocks(stack.blocks),
                },
            ];
        }) ?? [];

    return {
        ...createDefaultLocalSandboxGarden(options),
        backgroundPalette: isGameBackgroundPaletteKey(
            storedGarden.backgroundPalette,
        )
            ? storedGarden.backgroundPalette
            : (options.backgroundPalette ?? defaultGameBackgroundPaletteKey),
        stacks:
            stacks.length > 0
                ? stacks
                : resolveDefaultLocalSandboxStacks(options.stacks),
    };
}

export function loadLocalSandboxGarden(
    storageKey: string,
    options: LocalSandboxGardenOptions = {},
): LocalSandboxGarden {
    if (typeof window === 'undefined') {
        return createDefaultLocalSandboxGarden(options);
    }

    try {
        const storedValue = window.localStorage.getItem(storageKey);
        if (!storedValue) {
            return createDefaultLocalSandboxGarden(options);
        }

        return normalizeStoredGarden(
            JSON.parse(storedValue) as StoredLocalSandboxGarden,
            options,
        );
    } catch (error) {
        console.warn('Failed to load local sandbox garden', error);
        return createDefaultLocalSandboxGarden(options);
    }
}

export function persistLocalSandboxGarden(
    storageKey: string,
    garden: Pick<LocalSandboxGarden, 'stacks'> &
        Partial<Pick<LocalSandboxGarden, 'backgroundPalette'>>,
) {
    if (typeof window === 'undefined') {
        return;
    }

    const storedBackgroundPalette =
        garden.backgroundPalette ??
        getStoredLocalSandboxBackgroundPalette(storageKey) ??
        defaultGameBackgroundPaletteKey;
    const storedGarden: StoredLocalSandboxGarden = {
        backgroundPalette: storedBackgroundPalette,
        stacks: garden.stacks.map((stack) => ({
            position: {
                x: stack.position.x,
                z: stack.position.z,
            },
            blocks: stack.blocks.map((block) => ({
                id: block.id,
                name: block.name,
                rotation: block.rotation,
                variant: block.variant,
            })),
        })),
    };

    try {
        window.localStorage.setItem(storageKey, JSON.stringify(storedGarden));
    } catch (error) {
        console.warn('Failed to persist local sandbox garden', error);
    }
}

function getStoredLocalSandboxBackgroundPalette(storageKey: string) {
    try {
        const storedValue = window.localStorage.getItem(storageKey);
        if (!storedValue) {
            return null;
        }

        const storedGarden = JSON.parse(
            storedValue,
        ) as StoredLocalSandboxGarden;
        return isGameBackgroundPaletteKey(storedGarden.backgroundPalette)
            ? storedGarden.backgroundPalette
            : null;
    } catch {
        return null;
    }
}

export function resetLocalSandboxGarden(
    storageKey: string,
    options: LocalSandboxGardenOptions = {},
) {
    if (typeof window === 'undefined') {
        return createDefaultLocalSandboxGarden(options);
    }

    try {
        window.localStorage.removeItem(storageKey);
    } catch (error) {
        console.warn('Failed to reset local sandbox garden', error);
    }

    return createDefaultLocalSandboxGarden(options);
}

export function createLocalSandboxBlockId(blockName: string) {
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).slice(2);
    return `local-block:${blockName}:${timestamp}:${randomSuffix}`;
}
