import {
    createIndexedGardenAvatarCollisionWorld,
    type GardenAvatarMovementSurface,
    gardenAvatarRadius,
    gardenAvatarStandingCollisionHeight,
} from '../entities/avatar/gardenAvatarMovement';
import type {
    GardenStructureCollisionBoxes,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

const collisionBoundsStride = 6;
const coordinateStride = 2;
const portalClearanceEpsilon = 0.000_01;

function assertGardenStructurePortalsFitAvatar(
    plan: GardenStructureSemanticPlan,
) {
    const minimumWidth = gardenAvatarRadius * 2;
    for (const [index, portalId] of plan.openPortals.ids.entries()) {
        const clearanceWidth = plan.openPortals.clearances[index * 2];
        const clearanceHeight = plan.openPortals.clearances[index * 2 + 1];
        if (
            clearanceWidth === undefined ||
            clearanceHeight === undefined ||
            clearanceWidth + portalClearanceEpsilon < minimumWidth ||
            clearanceHeight + portalClearanceEpsilon <
                gardenAvatarStandingCollisionHeight
        ) {
            throw new Error(
                `Garden structure portal "${portalId}" does not fit the standing avatar collision envelope.`,
            );
        }
    }
}

function collisionSurfacesFromBoxes(
    boxes: GardenStructureCollisionBoxes,
): GardenAvatarMovementSurface[] {
    return boxes.ids.flatMap((id, index) => {
        const offset = index * collisionBoundsStride;
        const minX = boxes.bounds[offset];
        const minZ = boxes.bounds[offset + 1];
        const maxX = boxes.bounds[offset + 2];
        const maxZ = boxes.bounds[offset + 3];
        const minHeight = boxes.bounds[offset + 4];
        const maxHeight = boxes.bounds[offset + 5];
        if (
            minX === undefined ||
            minZ === undefined ||
            maxX === undefined ||
            maxZ === undefined ||
            minHeight === undefined ||
            maxHeight === undefined
        ) {
            return [];
        }

        return [
            {
                bottomY: minHeight,
                debugLabel: id,
                halfDepth: (maxZ - minZ) / 2,
                halfWidth: (maxX - minX) / 2,
                kind: 'ground',
                roamable: false,
                roamBlockedCells: [],
                rotation: 0,
                x: (minX + maxX) / 2,
                y: maxHeight,
                z: (minZ + maxZ) / 2,
            },
        ];
    });
}

export function createGardenStructureAvatarCollisionWorld(
    plan: GardenStructureSemanticPlan,
) {
    assertGardenStructurePortalsFitAvatar(plan);
    const floorSurfaces: GardenAvatarMovementSurface[] =
        plan.floors.ids.flatMap((id, index) => {
            const offset = index * coordinateStride;
            const x = plan.floors.coordinates[offset];
            const z = plan.floors.coordinates[offset + 1];
            if (x === undefined || z === undefined) {
                return [];
            }
            return [
                {
                    bottomY: plan.baseHeight,
                    debugLabel: id,
                    halfDepth: 0.5,
                    halfWidth: 0.5,
                    kind: 'ground',
                    roamable: true,
                    rotation: 0,
                    x,
                    y: plan.baseHeight,
                    z,
                },
            ];
        });
    const ceilingSurfaces: GardenAvatarMovementSurface[] =
        plan.ceilingProxies.ids.flatMap((id, index) => {
            const offset = index * collisionBoundsStride;
            const minX = plan.ceilingProxies.bounds[offset];
            const minZ = plan.ceilingProxies.bounds[offset + 1];
            const maxX = plan.ceilingProxies.bounds[offset + 2];
            const maxZ = plan.ceilingProxies.bounds[offset + 3];
            const minHeight = plan.ceilingProxies.bounds[offset + 4];
            const maxHeight = plan.ceilingProxies.bounds[offset + 5];
            if (
                minX === undefined ||
                minZ === undefined ||
                maxX === undefined ||
                maxZ === undefined ||
                minHeight === undefined ||
                maxHeight === undefined
            ) {
                return [];
            }
            return [
                {
                    bottomY: minHeight,
                    debugLabel: id,
                    halfDepth: (maxZ - minZ) / 2,
                    halfWidth: (maxX - minX) / 2,
                    kind: 'ground',
                    roamable: false,
                    roamBlockedCells: [],
                    rotation: 0,
                    x: (minX + maxX) / 2,
                    y: maxHeight,
                    z: (minZ + maxZ) / 2,
                },
            ];
        });

    return createIndexedGardenAvatarCollisionWorld({
        blockedCells: [],
        surfaces: [
            ...floorSurfaces,
            ...collisionSurfacesFromBoxes(plan.wallCollisionBoxes),
            ...collisionSurfacesFromBoxes(plan.propCollisionBoxes),
            ...ceilingSurfaces,
        ],
    });
}
