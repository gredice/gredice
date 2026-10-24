import { type Matrix4, type Object3D, Vector3 } from 'three';
import {
    type AutumnLeafBatchData,
    type AutumnTreeAnchor,
    getAutumnTreeInfluence,
} from '../../scene/autumnAccumulation';
import { autumnSeed } from '../../scene/autumnState';
import type { GameQualityProfileTier } from '../../scene/gameQuality';
import { getRaisedBedFootprintSegments } from '../../utils/raisedBedBlocks';
import type { EntityBlockInstance } from '../EntityInstancesBlock';
import {
    type AutumnPartLeafSurface,
    autumnLeafSurfaces,
} from './autumnLeafSurfaces';

export const autumnEntityCaps = {
    low: 24,
    'auto-constrained': 48,
    medium: 96,
    high: 160,
    custom: 128,
} satisfies Record<GameQualityProfileTier, number>;

export type AutumnPartCandidate = {
    blockId: string;
    partId: string;
    coordinateSpace: 'part-local';
    eligibilityPolicy: 'always' | 'closed-and-settled';
    surfaces: readonly AutumnPartLeafSurface[];
    matrix: Matrix4;
    object?: Object3D;
    instance?: EntityBlockInstance;
    eligible: boolean;
    covered: boolean;
};

export type AutumnPartLeafPlacement = {
    id: string;
    part: AutumnPartCandidate;
    surface: AutumnPartLeafSurface;
    variant: number;
    rank: number;
    surfaceCount: number;
};

export type AutumnEntityAllocation = {
    blocks: AutumnLeafBatchData[];
    parts: Map<number, AutumnPartLeafPlacement[]>;
};

type AllocationInput = {
    instances: readonly EntityBlockInstance[];
    parts?: readonly AutumnPartCandidate[];
    trees: readonly AutumnTreeAnchor[];
    amount: number;
    snow: number;
    tier: GameQualityProfileTier;
    year: number;
    gardenId: number | undefined;
};

type AllocationEntry =
    | { blockId: string; instance: EntityBlockInstance; part?: never }
    | { blockId: string; instance?: never; part: AutumnPartCandidate };

export function getAutumnVisibleSurfaceCount(
    surfaceCount: number,
    x: number,
    z: number,
    trees: readonly AutumnTreeAnchor[],
    amount: number,
    snow: number,
) {
    const influence = getAutumnTreeInfluence(x, z, trees);
    if (![surfaceCount, x, z, influence, amount, snow].every(Number.isFinite))
        return 0;
    return Math.round(
        surfaceCount *
            Math.min(1, Math.max(0, amount)) *
            influence *
            (1 - Math.min(1, Math.max(0, snow))) ** 2,
    );
}

/** One ordered pass applies the scene cap to block-local and part-local
 * candidates. The block-only call retains the original IDs and ordering.
 */
export function createAutumnEntityAllocation({
    instances,
    parts = [],
    trees,
    amount,
    snow,
    tier,
    year,
    gardenId,
}: AllocationInput): AutumnEntityAllocation {
    const batches = new Map<string, AutumnLeafBatchData>();
    const partBatches = new Map<number, AutumnPartLeafPlacement[]>();
    const empty = { blocks: [], parts: partBatches };
    if (![amount, snow].every(Number.isFinite)) return empty;
    const densityAt = (x: number, z: number) =>
        Math.min(1, Math.max(0, amount)) *
        getAutumnTreeInfluence(x, z, trees) *
        (1 - Math.min(1, Math.max(0, snow))) ** 2;
    const variantFor = (seed: string, id: string) =>
        tier === 'low' || tier === 'auto-constrained'
            ? 0
            : Math.floor(autumnSeed(`${seed}:${id}:yaw`) * 2);
    const addBlock = (
        instance: EntityBlockInstance,
        id: string,
        position: [number, number, number],
        rotation: number,
        gradientX: number,
        gradientZ: number,
        variant: number,
    ) => {
        const key = `${gradientX}:${gradientZ}:${variant}`;
        let batch = batches.get(key);
        if (!batch) {
            batch = {
                key,
                gradientX,
                gradientZ,
                variant,
                scale: 0.45,
                instances: [],
            };
            batches.set(key, batch);
        }
        batch.instances.push({
            ...instance,
            id,
            pickupOutlineVisible: false,
            rotation,
            position,
        });
    };
    const entries: AllocationEntry[] = [
        ...instances.map((instance) => ({
            blockId: instance.block.id,
            instance,
        })),
        ...parts.map((part) => ({
            blockId: part.blockId,
            part,
        })),
    ];
    entries.sort(
        (a, b) =>
            a.blockId.localeCompare(b.blockId) ||
            (a.part?.partId ?? '').localeCompare(b.part?.partId ?? ''),
    );
    let total = 0;
    for (const entry of entries) {
        if (total >= autumnEntityCaps[tier]) break;
        const { instance, part } = entry;
        const seed = `${gardenId}:${entry.blockId}:${year}`;
        if (instance) {
            const surfaces = autumnLeafSurfaces[instance.block.name];
            if (
                !surfaces ||
                instance.stack.blocks
                    .slice(instance.blockIndex + 1)
                    .some((block) => block.name.startsWith('Block_'))
            )
                continue;
            const ordered = [...surfaces].sort(
                (a, b) =>
                    autumnSeed(`${seed}:${a.id}`) -
                    autumnSeed(`${seed}:${b.id}`),
            );
            const segments =
                instance.block.name === 'Raised_Bed'
                    ? getRaisedBedFootprintSegments(instance.rotation)
                    : [
                          {
                              blockIndex: 0,
                              offset: { x: 0, z: 0 },
                              shapeRotation: instance.rotation,
                          },
                      ];
            for (const segment of segments) {
                const count = Math.round(
                    ordered.length *
                        densityAt(
                            instance.position[0] + segment.offset.x,
                            instance.position[2] + segment.offset.z,
                        ),
                );
                for (const surface of ordered.slice(0, count)) {
                    if (total >= autumnEntityCaps[tier]) break;
                    const [x, y, z] = surface.position;
                    const angle = (segment.shapeRotation * Math.PI) / 2;
                    addBlock(
                        instance,
                        `${instance.id}:autumn:${segment.blockIndex}:${surface.id}`,
                        [
                            instance.position[0] +
                                segment.offset.x +
                                x * Math.cos(angle) +
                                z * Math.sin(angle),
                            instance.position[1] + y + 0.006,
                            instance.position[2] +
                                segment.offset.z -
                                x * Math.sin(angle) +
                                z * Math.cos(angle),
                        ],
                        segment.shapeRotation,
                        surface.gradientX ?? 0,
                        surface.gradientZ ?? 0,
                        variantFor(seed, surface.id),
                    );
                    total++;
                }
            }
            continue;
        }
        if (!part?.eligible || part.covered) continue;
        const origin = new Vector3().setFromMatrixPosition(part.matrix);
        if (!origin.toArray().every(Number.isFinite)) continue;
        const ordered = [...part.surfaces].sort(
            (a, b) =>
                autumnSeed(`${seed}:${part.partId}:${a.id}`) -
                autumnSeed(`${seed}:${part.partId}:${b.id}`),
        );
        const count = getAutumnVisibleSurfaceCount(
            ordered.length,
            origin.x,
            origin.z,
            trees,
            amount,
            snow,
        );
        for (const [rank, surface] of ordered.slice(0, count).entries()) {
            if (total >= autumnEntityCaps[tier]) break;
            const id = `${entry.blockId}:autumn:${part.partId}:${surface.id}`;
            const variant = variantFor(seed, `${part.partId}:${surface.id}`);
            if (part.instance) {
                const point = new Vector3(...surface.position)
                    .add(new Vector3(0, 0.006, 0))
                    .applyMatrix4(part.matrix);
                if (!point.toArray().every(Number.isFinite)) continue;
                addBlock(
                    part.instance,
                    id,
                    [point.x, point.y, point.z],
                    part.instance.rotation,
                    surface.gradientX ?? 0,
                    surface.gradientZ ?? 0,
                    variant,
                );
            } else {
                const batch = partBatches.get(variant) ?? [];
                batch.push({
                    id,
                    part,
                    surface,
                    variant,
                    rank,
                    surfaceCount: ordered.length,
                });
                partBatches.set(variant, batch);
            }
            total++;
        }
    }
    return { blocks: [...batches.values()], parts: partBatches };
}

export function createAutumnEntityBatches(
    input: Omit<AllocationInput, 'parts'>,
) {
    return createAutumnEntityAllocation(input).blocks;
}
