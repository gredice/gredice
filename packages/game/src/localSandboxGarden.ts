import {
    defaultGameBackgroundPaletteKey,
    type GameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';
import {
    normalizeWoodenSignMessage,
    woodenSignBlockName,
} from '@gredice/js/woodenSign';
import type { Block } from './types/Block';
import { createGardenPosition, type GardenStack } from './types/Stack';

export const localSandboxGardenId = 0;
export const defaultLocalSandboxStorageKey = 'gredice.debug.sandbox.garden.v1';

export type LocalSandboxGarden = {
    id: number;
    name: string;
    isSandbox: true;
    isPublic: false;
    backgroundPalette: GameBackgroundPaletteKey;
    homeCamera: null;
    stacks: GardenStack[];
    structures: [];
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
    stacks?: GardenStack[];
};

function createDefaultLocalSandboxStacks(): GardenStack[] {
    const stacks: GardenStack[] = [];

    for (let x = -2; x <= 2; x += 1) {
        for (let z = -2; z <= 2; z += 1) {
            stacks.push({
                position: createGardenPosition(x, 0, z),
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

function cloneSandboxStacks(stacks: GardenStack[]): GardenStack[] {
    return stacks.map((stack) => ({
        position: createGardenPosition(
            stack.position.x,
            stack.position.y,
            stack.position.z,
        ),
        blocks: stack.blocks.map((block) => ({ ...block })),
    }));
}

function resolveDefaultLocalSandboxStacks(stacks: GardenStack[] | undefined) {
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
        homeCamera: null,
        stacks: resolveDefaultLocalSandboxStacks(options.stacks),
        structures: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    };
}

function isStoredBlock(value: unknown): value is Partial<Block> {
    return typeof value === 'object' && value !== null;
}

function normalizeStoredWoodenSignMessage(candidate: Partial<Block>) {
    if (candidate.name !== woodenSignBlockName) {
        return undefined;
    }
    if (candidate.message === null) {
        return null;
    }
    if (typeof candidate.message !== 'string') {
        return undefined;
    }

    try {
        return normalizeWoodenSignMessage(candidate.message);
    } catch {
        return undefined;
    }
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
                message: normalizeStoredWoodenSignMessage(candidate),
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
                    position: createGardenPosition(x, 0, z),
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
                message:
                    block.name === woodenSignBlockName
                        ? (block.message ?? null)
                        : undefined,
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
