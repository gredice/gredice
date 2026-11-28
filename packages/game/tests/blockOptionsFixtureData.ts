import type { BlockData } from '@gredice/client';
import type {
    BlockEditingState,
    HudObstacleRect,
} from '../src/blockOptions/blockEditingState';
import type { CurrentGarden } from '../src/hooks/useCurrentGarden';
import { withInternalSceneBlockData } from '../src/internalSceneBlockData';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import type { GardenStack } from '../src/types/Stack';

// Shared by `BlockOptionsFixture` (browser) and the block-options specs
// (Node). Keep it free of React, three and DOM imports so specs can import it.

export const blockOptionsFixtureGardenId = 951;
export const blockOptionsFixtureAccountId =
    '51000000-0000-4000-8000-000000000001';
export const blockOptionsFixtureUserId = 'block-options-user';
export const blockOptionsFixtureRaisedBedId = 701;
/** `localStorage` key of the local sandbox variant (`localSandbox` prop). */
export const blockOptionsFixtureLocalSandboxKey = 'block-options-fixture';
/** Default frozen game time: a summer morning in Zagreb (daytime). */
export const blockOptionsFixtureDayTime = '2026-06-15T08:00:00Z';
/** A summer night in Zagreb, for night-only purchase checks. */
export const blockOptionsFixtureNightTime = '2026-06-15T22:30:00Z';

const gardenMin = -4;
const gardenMax = 4;

/** Ids of the placed blocks the specs act on. */
export const blockOptionsFixtureBlockIds = {
    /** Per-entity block (full entity and `PickableGroup`) on grass at (0, 0). */
    beachBall: 'beach-ball',
    /** Per-entity block on grass at (2, 2). */
    snowman: 'snowman',
    /** Instanced decoration on grass at (-2, 0). */
    bush: 'bush',
    /** Instanced flower on grass at (1, -1). */
    tulip: 'tulip',
    /** `Raised_Bed` at (-3, 2), raised bed 701, status `approved`. */
    raisedBed: 'raised-bed',
    /** `GardenBox` on grass at (3, 1). */
    gardenBox: 'garden-box',
    /** `ChickenCoop` (animal home, not expandable) on grass at (-3, -3). */
    chickenCoop: 'chicken-coop',
    /** Second `Block_Grass` of the one raised step at (-1, -2). */
    step: 'step:-1:-2',
} as const;

/** Id of the ground `Block_Grass` at a cell. */
export function blockOptionsFixtureGroundId(x: number, z: number) {
    return `ground:${x}:${z}`;
}

/**
 * Cells with no block at all. A 3 × 2 hole at x 2–4, z −4…−3 (next to the
 * ground at x 1 and z −2, so terrain Expand has empty cells to fill) and one
 * corner cell.
 */
export const blockOptionsFixtureGapCells: readonly { x: number; z: number }[] =
    [
        { x: 2, z: -4 },
        { x: 3, z: -4 },
        { x: 4, z: -4 },
        { x: 2, z: -3 },
        { x: 3, z: -3 },
        { x: 4, z: -3 },
        { x: -4, z: 4 },
    ];

/** Cells and names of the blocks that stand on the ground `Block_Grass`. */
export const blockOptionsFixtureBlockCells = {
    [blockOptionsFixtureBlockIds.beachBall]: {
        x: 0,
        z: 0,
        name: 'BeachBall',
    },
    [blockOptionsFixtureBlockIds.snowman]: { x: 2, z: 2, name: 'Snowman' },
    [blockOptionsFixtureBlockIds.bush]: { x: -2, z: 0, name: 'Bush' },
    [blockOptionsFixtureBlockIds.tulip]: { x: 1, z: -1, name: 'Tulip' },
    [blockOptionsFixtureBlockIds.raisedBed]: {
        x: -3,
        z: 2,
        name: 'Raised_Bed',
    },
    [blockOptionsFixtureBlockIds.gardenBox]: {
        x: 3,
        z: 1,
        name: 'GardenBox',
    },
    [blockOptionsFixtureBlockIds.chickenCoop]: {
        x: -3,
        z: -3,
        name: 'ChickenCoop',
    },
    [blockOptionsFixtureBlockIds.step]: { x: -1, z: -2, name: 'Block_Grass' },
} as const;

/** Sunflower prices of the fixture's block data; other blocks cost 20. */
export const blockOptionsFixtureBlockPrices: Readonly<Record<string, number>> =
    {
        Block_Grass: 10,
        Bush: 25,
        Tulip: 15,
        BeachBall: 30,
        Snowman: 40,
        GardenBox: 50,
        Raised_Bed: 100,
        ChickenCoop: 300,
    };
const defaultFixtureBlockPrice = 20;

function isGapCell(x: number, z: number) {
    return blockOptionsFixtureGapCells.some(
        (cell) => cell.x === x && cell.z === z,
    );
}

/**
 * The fixture garden's stacks: a 9 × 9 `Block_Grass` patch (x and z −4…4)
 * with the gaps above, one raised step and the blocks above on top of the
 * grass.
 */
export function createBlockOptionsFixtureStacks(): GardenStack[] {
    const stacks: GardenStack[] = [];
    for (let z = gardenMin; z <= gardenMax; z++) {
        for (let x = gardenMin; x <= gardenMax; x++) {
            if (isGapCell(x, z)) {
                continue;
            }

            const blocks = [
                {
                    id: blockOptionsFixtureGroundId(x, z),
                    name: 'Block_Grass',
                    rotation: 0,
                },
            ];
            for (const [id, cell] of Object.entries(
                blockOptionsFixtureBlockCells,
            )) {
                if (cell.x === x && cell.z === z) {
                    blocks.push({ id, name: cell.name, rotation: 0 });
                }
            }
            stacks.push({ position: { x, y: 0, z }, blocks });
        }
    }

    return stacks;
}

export function createBlockOptionsFixtureGarden({
    sandbox = false,
    stacks = createBlockOptionsFixtureStacks(),
}: {
    sandbox?: boolean;
    stacks?: GardenStack[];
} = {}): CurrentGarden {
    return {
        id: blockOptionsFixtureGardenId,
        name: 'Vrt za radnje s blokom',
        isSandbox: sandbox,
        isPublic: false,
        homeCamera: null,
        backgroundPalette: 'golden',
        farmId: null,
        location: { lat: 45.8, lon: 16 },
        raisedBeds: [
            {
                id: blockOptionsFixtureRaisedBedId,
                name: 'Gredica uz kokošinjac',
                blockId: blockOptionsFixtureBlockIds.raisedBed,
                status: 'approved',
                isValid: true,
                orientation: 'vertical',
                physicalId: null,
                abandonReason: null,
                weedState: null,
                fields: [],
                plantings: [],
                appliedOperations: [],
                createdAt: '2026-05-01T08:00:00.000Z',
                updatedAt: '2026-05-01T08:00:00.000Z',
            },
        ],
        stacks,
    };
}

/**
 * Block data for the fixture: the local sandbox catalogue (every block the
 * game draws) with sunflower prices, plus the internal scene blocks the real
 * query adds. `prices` and `nightOnly` override single blocks.
 */
export function createBlockOptionsFixtureBlockData({
    prices = {},
    nightOnly = [],
}: {
    prices?: Readonly<Record<string, number>>;
    nightOnly?: readonly string[];
} = {}): BlockData[] {
    return withInternalSceneBlockData(
        getLocalSandboxBlockData().map((block) => {
            const name = block.information.name;
            return {
                ...block,
                attributes: {
                    ...block.attributes,
                    nightOnlyPurchase: nightOnly.includes(name),
                },
                prices: {
                    ...block.prices,
                    sunflowers:
                        prices[name] ??
                        blockOptionsFixtureBlockPrices[name] ??
                        defaultFixtureBlockPrice,
                },
            };
        }),
    );
}

/**
 * The garden as `GET /api/gardens/:gardenId` returns it (stacks nested by x
 * and z), for routing refetches after an invalidation.
 */
export function toBlockOptionsGardenResponse(garden: CurrentGarden) {
    const stacks: Record<string, Record<string, GardenStack['blocks']>> = {};
    for (const stack of garden.stacks) {
        const x = stack.position.x.toString();
        stacks[x] ??= {};
        stacks[x][stack.position.z.toString()] = stack.blocks;
    }

    return {
        id: garden.id,
        name: garden.name,
        isSandbox: garden.isSandbox,
        isPublic: garden.isPublic,
        backgroundPalette: garden.backgroundPalette,
        homeCamera: garden.homeCamera,
        farmId: garden.farmId ?? null,
        latitude: garden.location.lat,
        longitude: garden.location.lon,
        raisedBeds: garden.raisedBeds,
        stacks,
    };
}

export type BlockOptionsFixtureViewport = 'desktop' | 'phone';

/** Stage size per viewport hint; set the page viewport to at least this. */
export const blockOptionsFixtureStageSizes: Record<
    BlockOptionsFixtureViewport,
    { width: number; height: number }
> = {
    desktop: { width: 960, height: 640 },
    phone: { width: 360, height: 740 },
};

export type BlockOptionsProbePoint = { x: number; y: number };

/**
 * Outline flags. Per-entity blocks keep their outline target mounted and
 * only toggle it inside the outline registry, and the outline pass publishes
 * its counts only on the `/debug/profile/game` route, so per-entity outlines
 * are not observable here; instanced ones are.
 */
export type BlockOptionsProbeOutline = {
    /**
     * Cells of the outline targets mounted now by instanced blocks. Instanced
     * blocks mount an outline target only while it is drawn (pickup, editing
     * or hover), so this lists exactly the outlined instanced blocks.
     */
    instancedCells: { x: number; z: number }[];
    /** `stationaryPickupOutlineTarget` from the store, as `blockId`. */
    stationaryPickupBlockId: string | null;
};

export type BlockOptionsProbeCamera = {
    position: [x: number, y: number, z: number];
    target: [x: number, y: number, z: number] | null;
    zoom: number;
    /** The rig's placement lock (a pickup or a HUD drag is active). */
    placementLocked: boolean;
};

export type BlockOptionsProbeBlock = {
    id: string;
    name: string;
    x: number;
    z: number;
    index: number;
    rotation: number;
};

export type BlockOptionsProbeSnapshot = {
    /**
     * Garden and block data are loaded, the scene has drawn a frame and
     * every per-entity block has a mesh on its cell.
     */
    ready: boolean;
    /** Frames the renderer has drawn since the fixture mounted. */
    frames: number;
    /**
     * Per-entity (not instanced) blocks with no mesh on their cell yet,
     * usually because their model is still loading.
     */
    pendingEntityBlockIds: string[];
    blockEditing: BlockEditingState | null;
    camera: BlockOptionsProbeCamera;
    outline: BlockOptionsProbeOutline;
    pickupBlockId: string | null;
    hudPlacementDragActive: boolean;
    hudObstacles: HudObstacleRect[];
    /** Client position of the editing block's pop-up anchor. */
    editingAnchor: BlockOptionsProbePoint | null;
    garden: {
        id: number;
        isSandbox: boolean;
        blocks: BlockOptionsProbeBlock[];
    } | null;
};

export type BlockOptionsProbeExpandResult =
    | { ok: true }
    | { ok: false; reason: string };

/**
 * `window.__blockOptionsProbe`, installed by `BlockOptionsProbe` inside the
 * fixture's Canvas. Read it with `page.evaluate`; getters are live.
 */
export type BlockOptionsProbeApi = BlockOptionsProbeSnapshot & {
    snapshot: () => BlockOptionsProbeSnapshot;
    /**
     * Opens the options pop-up on a placed block, as a hold-release does.
     * Returns the new editing state, or null when the block is not in the
     * garden.
     */
    openBlockOptions: (
        blockId: string,
        pointerType?: string,
    ) => BlockEditingState | null;
    /** Opens the pop-up if needed and starts Expand, as Proširi does. */
    startBlockExpand: (blockId: string) => BlockOptionsProbeExpandResult;
    setBlockExpandCorner: (x: number, z: number) => void;
    /** Pop-up → remove confirmation, as Recikliraj/Obriši does. */
    requestBlockRemove: () => void;
    closeBlockEditing: () => void;
    /** Client position of a world point, or null when the canvas is gone. */
    projectWorld: (
        x: number,
        y: number,
        z: number,
    ) => BlockOptionsProbePoint | null;
    /**
     * Client position on a placed block: its pop-up anchor, the middle of
     * its height (for pressing it) or its top centre.
     */
    blockScreenPosition: (
        blockId: string,
        part?: 'anchor' | 'center' | 'top',
    ) => BlockOptionsProbePoint | null;
    /** Objects in the scene whose name starts with `prefix`. */
    countObjects: (prefix: string) => number;
    /**
     * The renderer's live GPU resources: linked shader programs and
     * uploaded geometries and textures (`renderer.info`).
     */
    renderResources: () => {
        programs: number;
        geometries: number;
        textures: number;
    };
    /** Asks the scene for a frame, as any scene change does. */
    requestRender: () => void;
    /**
     * Identities of GPU resources, which counts alone cannot tell apart: a
     * program or geometry disposed and built again leaves every count as
     * it was. `programs`: each linked program as `id:name` (a relinked
     * program gets a new id). `expandGeometries` and `expandMaterials`:
     * the ids used by the Expand preview's meshes (`BlockExpand:*`).
     */
    renderResourceIds: () => {
        programs: string[];
        expandGeometries: number[];
        expandMaterials: number[];
    };
    /** Marks the garden query stale and refetches it (route its GET first). */
    invalidateGarden: () => Promise<void>;
};

declare global {
    interface Window {
        __blockOptionsProbe?: BlockOptionsProbeApi;
    }
}
