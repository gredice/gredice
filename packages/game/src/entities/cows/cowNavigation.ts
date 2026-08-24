import type { BlockData } from '@gredice/client';
import { MathUtils, Vector3 } from 'three';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/getStackHeight';
import {
    type AnimalMovementCell,
    type AnimalMovementSurface,
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
    getAnimalMovementYAt,
} from '../animals/animalMovementTerrain';
import { type CatPathResult, findCatPath } from '../cats/catPathfinding';
import { getPersistentPetHomePlacement } from '../persistentPets/persistentPetHomes';
import {
    type CowBehavior,
    getCowDwellSeconds,
    getCowMovementSpeed,
} from './cowBehavior';

export const cowGroundLift = 0.025;
export const cowRoamRange = 5.5;

export function getCowPlacementCenter({
    rotation,
    x,
    z,
}: {
    rotation: number;
    x: number;
    z: number;
}) {
    const normalizedRotation = ((Math.round(rotation) % 2) + 2) % 2;
    return normalizedRotation === 0 ? { x, z: z + 0.5 } : { x: x + 0.5, z };
}

export type CowTarget = {
    behavior: CowBehavior;
    facingYaw?: number;
    id: string;
    lookAtPosition?: Vector3;
    position: Vector3;
};

export type CowHabitat = {
    blockedCells: AnimalMovementCell[];
    groundSurfaces: AnimalMovementSurface[];
    home: CowTarget;
    id: string;
    roamAnchors: CowTarget[];
    seed: number;
};

type MovingCowRuntimeState = {
    duration: number;
    path: Vector3[];
    pathDistance: number;
    pathfinding: CatPathResult;
    phase: 'moving';
    startedAt: number;
    target: CowTarget;
    to: Vector3;
};

type SettledCowRuntimeState = {
    dwellUntil: number;
    phase: 'settled';
    target: CowTarget;
};

export type CowRuntimeState = MovingCowRuntimeState | SettledCowRuntimeState;

export function hashCowSeed(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createCowRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

function cellKey(cell: AnimalMovementCell) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

function addBlockedCell(
    blockedByKey: Map<string, AnimalMovementCell>,
    x: number,
    z: number,
) {
    const cell = { x: Math.round(x), z: Math.round(z) };
    blockedByKey.set(cellKey(cell), cell);
}

function createCowNavigationBlockedCells({
    blockData,
    homeCells,
    preserveHomeFootprint,
    stacks,
    surfaces,
}: {
    blockData: BlockData[] | null | undefined;
    homeCells: AnimalMovementCell[];
    preserveHomeFootprint: boolean;
    stacks: Stack[] | undefined;
    surfaces: AnimalMovementSurface[];
}) {
    const blockedByKey = new Map<string, AnimalMovementCell>();
    const homeKeys = new Set(homeCells.map(cellKey));
    const obstacleCells = createAnimalBlockedCells(stacks, {
        blockData,
    }).filter((cell) => !homeKeys.has(cellKey(cell)));

    for (const obstacle of obstacleCells) {
        for (let x = obstacle.x - 1; x <= obstacle.x + 1; x += 1) {
            for (let z = obstacle.z - 1; z <= obstacle.z + 1; z += 1) {
                addBlockedCell(blockedByKey, x, z);
            }
        }
    }

    if (surfaces.length === 0) {
        return [...blockedByKey.values()];
    }

    const minX = Math.floor(Math.min(...surfaces.map((surface) => surface.x)));
    const maxX = Math.ceil(Math.max(...surfaces.map((surface) => surface.x)));
    const minZ = Math.floor(Math.min(...surfaces.map((surface) => surface.z)));
    const maxZ = Math.ceil(Math.max(...surfaces.map((surface) => surface.z)));
    const groundKeys = new Set(
        surfaces
            .filter((surface) => surface.kind === 'ground')
            .map((surface) => cellKey(surface)),
    );

    for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            if (!groundKeys.has(cellKey({ x, z }))) {
                addBlockedCell(blockedByKey, x, z);
            }
        }
    }
    for (let x = minX - 1; x <= maxX + 1; x += 1) {
        addBlockedCell(blockedByKey, x, minZ - 1);
        addBlockedCell(blockedByKey, x, maxZ + 1);
    }
    for (let z = minZ; z <= maxZ; z += 1) {
        addBlockedCell(blockedByKey, minX - 1, z);
        addBlockedCell(blockedByKey, maxX + 1, z);
    }

    for (const homeCell of homeCells) {
        if (preserveHomeFootprint) {
            blockedByKey.set(cellKey(homeCell), homeCell);
        } else {
            blockedByKey.delete(cellKey(homeCell));
        }
    }
    return [...blockedByKey.values()];
}

function horizontalDistance(
    left: Pick<Vector3, 'x' | 'z'>,
    right: Pick<Vector3, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

export function createCowHabitat({
    block,
    blockData,
    stack,
    stacks,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
    stacks: Stack[] | undefined;
}) {
    const groundSurfaces = createAnimalMovementSurfaces({
        blockData,
        groundLift: cowGroundLift,
        stacks,
        swimDepth: 0,
    });
    const shelterPlacement =
        block.name === 'CowShelter'
            ? getPersistentPetHomePlacement({
                  blockName: 'CowShelter',
                  rotation: block.rotation,
                  x: stack.position.x,
                  z: stack.position.z,
              })
            : null;
    const placementCenter =
        shelterPlacement?.center ??
        getCowPlacementCenter({
            rotation: block.rotation,
            x: stack.position.x,
            z: stack.position.z,
        });
    const normalizedRotation = ((Math.round(block.rotation) % 2) + 2) % 2;
    const homeCells = shelterPlacement
        ? Array.from(
              {
                  length:
                      shelterPlacement.spanWidth * shelterPlacement.spanDepth,
              },
              (_, index) => ({
                  x: stack.position.x + (index % shelterPlacement.spanWidth),
                  z:
                      stack.position.z +
                      Math.floor(index / shelterPlacement.spanWidth),
              }),
          )
        : [
              { x: stack.position.x, z: stack.position.z },
              normalizedRotation === 0
                  ? { x: stack.position.x, z: stack.position.z + 1 }
                  : { x: stack.position.x + 1, z: stack.position.z },
          ];
    const homeAnchor = shelterPlacement?.doorway ?? placementCenter;
    const homeSurface = getAnimalMovementSurfaceAt(homeAnchor, groundSurfaces);
    const homePosition = new Vector3(
        homeAnchor.x,
        homeSurface?.kind === 'ground'
            ? Math.max(cowGroundLift, homeSurface.y)
            : Math.max(
                  0,
                  getStackHeight(blockData, stack, block) + cowGroundLift,
              ),
        homeAnchor.z,
    );
    const home = {
        behavior: 'idle',
        facingYaw:
            shelterPlacement?.facingYaw ??
            block.rotation * (Math.PI / 2) + Math.PI,
        id: `home-${block.id}`,
        position: homePosition,
    } satisfies CowTarget;
    const blockedCells = createCowNavigationBlockedCells({
        blockData,
        homeCells,
        preserveHomeFootprint: shelterPlacement !== null,
        stacks,
        surfaces: groundSurfaces,
    });
    const blockedKeys = new Set(blockedCells.map(cellKey));
    const roamAnchors = groundSurfaces.flatMap((surface) => {
        if (
            surface.kind !== 'ground' ||
            horizontalDistance(surface, homePosition) > cowRoamRange ||
            blockedKeys.has(cellKey(surface))
        ) {
            return [];
        }
        return [
            {
                behavior: 'roam',
                id: `ground-${surface.x}-${surface.z}`,
                position: new Vector3(surface.x, surface.y, surface.z),
            } satisfies CowTarget,
        ];
    });

    return {
        blockedCells,
        groundSurfaces,
        home,
        id: `cow:${block.id}`,
        roamAnchors,
        seed: hashCowSeed(`${block.name}:${block.id}`),
    } satisfies CowHabitat;
}

function pathHorizontalDistance(path: Vector3[]) {
    let distance = 0;
    for (let index = 1; index < path.length; index += 1) {
        const previous = path[index - 1];
        const current = path[index];
        if (previous && current) {
            distance += horizontalDistance(previous, current);
        }
    }
    return distance;
}

export function cowPathPositionAtDistance(path: Vector3[], distance: number) {
    const first = path[0];
    if (!first) {
        return new Vector3();
    }
    let remaining = Math.max(0, distance);
    for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1];
        const to = path[index];
        if (!from || !to) {
            continue;
        }
        const segment = horizontalDistance(from, to);
        if (remaining <= segment) {
            return from
                .clone()
                .lerp(to, segment <= 0 ? 1 : remaining / segment);
        }
        remaining -= segment;
    }
    return path.at(-1)?.clone() ?? first.clone();
}

export function cowPathStaysOnValidTerrain(
    path: Vector3[],
    surfaces: AnimalMovementSurface[],
) {
    for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1];
        const to = path[index];
        if (!from || !to) {
            continue;
        }
        const distance = horizontalDistance(from, to);
        const sampleCount = Math.max(1, Math.ceil(distance / 0.16));
        for (let sample = 0; sample <= sampleCount; sample += 1) {
            const point = from.clone().lerp(to, sample / sampleCount);
            if (
                getAnimalMovementSurfaceAt(point, surfaces)?.kind !== 'ground'
            ) {
                return false;
            }
        }
    }
    return true;
}

export function makeSettledCowState({
    now,
    random,
    target,
}: {
    now: number;
    random: () => number;
    target: CowTarget;
}) {
    return {
        dwellUntil: now + getCowDwellSeconds(target.behavior, random),
        phase: 'settled',
        target,
    } satisfies SettledCowRuntimeState;
}

export function resolveCowRuntimeForTarget({
    from,
    habitat,
    now,
    random,
    target,
}: {
    from: Vector3;
    habitat: CowHabitat;
    now: number;
    random: () => number;
    target: CowTarget;
}): CowRuntimeState {
    const safeCurrentTarget = {
        behavior: 'idle',
        facingYaw: target.facingYaw,
        id: `safe-${habitat.id}`,
        position: from.clone(),
    } satisfies CowTarget;
    if (
        getAnimalMovementSurfaceAt(target.position, habitat.groundSurfaces)
            ?.kind !== 'ground'
    ) {
        return makeSettledCowState({ now, random, target: safeCurrentTarget });
    }
    if (horizontalDistance(from, target.position) < 0.1) {
        return makeSettledCowState({ now, random, target });
    }

    const walkFrom = from.clone();
    walkFrom.y = getAnimalMovementYAt(walkFrom, habitat.groundSurfaces);
    const walkTo = target.position.clone();
    walkTo.y = getAnimalMovementYAt(walkTo, habitat.groundSurfaces);
    const pathfinding = findCatPath({
        blockedCells: habitat.blockedCells,
        from: walkFrom,
        surfaces: habitat.groundSurfaces,
        to: walkTo,
    });
    const path = pathfinding.points.map(
        (point) => new Vector3(point.x, point.y, point.z),
    );
    if (
        pathfinding.status === 'unreachable' ||
        !cowPathStaysOnValidTerrain(path, habitat.groundSurfaces)
    ) {
        return makeSettledCowState({ now, random, target: safeCurrentTarget });
    }

    const pathDistance = Math.max(
        pathfinding.distance,
        pathHorizontalDistance(path),
    );
    return {
        duration: MathUtils.clamp(
            pathDistance / getCowMovementSpeed(target.behavior),
            target.behavior === 'trot' ? 0.5 : 0.75,
            target.behavior === 'trot' ? 4 : 12,
        ),
        path,
        pathDistance,
        pathfinding,
        phase: 'moving',
        startedAt: now,
        target,
        to: walkTo,
    };
}
