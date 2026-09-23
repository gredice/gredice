import { createMeshInstanceMatrix } from '../chunkedMeshGeometry';
import type { EntityBlockInstance } from '../EntityInstancesBlock';
import type { AutumnPartCandidate } from './autumnEntityPlacements';
import { autumnPartLeafSurfaces } from './autumnLeafSurfaces';

export const gardenBoxRootQuarterTurns = 2;
export const gardenBoxLidHingePosition: [number, number, number] = [
    0, 0.6, -0.38,
];
export const gardenBoxOpenLidRotation: [number, number, number] = [
    -Math.PI / 2,
    0,
    0,
];

/** Closed lid uses exactly the root correction and hinge transform of the
 * instanced body/lid split. The same block ID owns placement animation.
 */
export function createClosedGardenBoxLidCandidates({
    instances,
    openBlockIds,
    registeredBlockIds,
}: {
    instances: readonly EntityBlockInstance[];
    openBlockIds: ReadonlySet<string>;
    registeredBlockIds: ReadonlySet<string>;
}): AutumnPartCandidate[] {
    return instances
        .filter(
            (instance) =>
                !openBlockIds.has(instance.block.id) &&
                !registeredBlockIds.has(instance.block.id),
        )
        .map((instance) => {
            const rotated = {
                ...instance,
                rotation: instance.rotation + gardenBoxRootQuarterTurns,
            };
            return {
                blockId: instance.block.id,
                partId: 'GardenBox_Lid_HingeOrigin',
                coordinateSpace: 'part-local',
                eligibilityPolicy: 'closed-and-settled',
                surfaces: autumnPartLeafSurfaces.GardenBox_Lid_HingeOrigin,
                matrix: createMeshInstanceMatrix(
                    rotated,
                    {
                        position: gardenBoxLidHingePosition,
                        rotation: [0, 0, 0],
                    },
                    undefined,
                ),
                instance: rotated,
                eligible: true,
                covered: instance.stack.blocks
                    .slice(instance.blockIndex + 1)
                    .some((above) => above.name.startsWith('Block_')),
            };
        });
}
