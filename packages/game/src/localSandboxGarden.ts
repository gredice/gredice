import { Vector3 } from 'three';
import type { Block } from './types/Block';
import type { Stack } from './types/Stack';

export const localSandboxGardenId = 0;
export const defaultLocalSandboxStorageKey = 'gredice.debug.sandbox.garden.v1';

export type LocalSandboxGarden = {
    id: number;
    name: string;
    isSandbox: true;
    stacks: Stack[];
    location: {
        lat: number;
        lon: number;
    };
    raisedBeds: [];
};

type StoredLocalSandboxGarden = {
    stacks?: Array<{
        position?: {
            x?: unknown;
            z?: unknown;
        };
        blocks?: unknown;
    }>;
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

export function createDefaultLocalSandboxGarden(): LocalSandboxGarden {
    return {
        id: localSandboxGardenId,
        name: 'Debug sandbox',
        isSandbox: true,
        stacks: createDefaultLocalSandboxStacks(),
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
        ...createDefaultLocalSandboxGarden(),
        stacks: stacks.length > 0 ? stacks : createDefaultLocalSandboxStacks(),
    };
}

export function loadLocalSandboxGarden(storageKey: string): LocalSandboxGarden {
    if (typeof window === 'undefined') {
        return createDefaultLocalSandboxGarden();
    }

    try {
        const storedValue = window.localStorage.getItem(storageKey);
        if (!storedValue) {
            return createDefaultLocalSandboxGarden();
        }

        return normalizeStoredGarden(
            JSON.parse(storedValue) as StoredLocalSandboxGarden,
        );
    } catch (error) {
        console.warn('Failed to load local sandbox garden', error);
        return createDefaultLocalSandboxGarden();
    }
}

export function persistLocalSandboxGarden(
    storageKey: string,
    garden: Pick<LocalSandboxGarden, 'stacks'>,
) {
    if (typeof window === 'undefined') {
        return;
    }

    const storedGarden: StoredLocalSandboxGarden = {
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

export function resetLocalSandboxGarden(storageKey: string) {
    if (typeof window === 'undefined') {
        return createDefaultLocalSandboxGarden();
    }

    try {
        window.localStorage.removeItem(storageKey);
    } catch (error) {
        console.warn('Failed to reset local sandbox garden', error);
    }

    return createDefaultLocalSandboxGarden();
}

export function createLocalSandboxBlockId(blockName: string) {
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).slice(2);
    return `local-block:${blockName}:${timestamp}:${randomSuffix}`;
}
