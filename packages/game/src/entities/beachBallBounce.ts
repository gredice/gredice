import {
    type GardenBlockDataLike,
    getGardenBlockFootprintOffsets,
} from '@gredice/js/gardenBlocks';
import type { Stack } from '../types/Stack';

export type BeachBallBounceObstacle = {
    x: number;
    z: number;
};

export type BeachBallBounceBounds = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

export type BeachBallBounceEnvironment = {
    bounds: BeachBallBounceBounds | null;
    obstacles: BeachBallBounceObstacle[];
    radius: number;
};

export type BeachBallBounceState = {
    active: boolean;
    elapsedSeconds: number;
    offsetX: number;
    offsetZ: number;
    velocityX: number;
    velocityZ: number;
};

type BeachBallBlockDataLike = GardenBlockDataLike & {
    information: {
        name: string;
    };
};

const obstacleHalfExtent = 0.5;
const maxFrameDeltaSeconds = 1 / 24;
const bounceRestitution = 0.82;
const reboundStepRatio = 0.35;
const velocityDampingPerSecond = 0.6;
const minimumActiveSpeed = 0.16;
const maxMotionSeconds = 5.4;

export const beachBallCollisionRadius = 0.24;

const passableTerrainBlockNames = new Set([
    'Block_Ground',
    'Block_Ground_Angle',
    'Block_Grass',
    'Block_Grass_Angle',
    'Block_Grass_Corner',
    'Block_Grass_Reverse_Corner',
    'Block_Sand',
    'Block_Sand_Angle',
    'Block_Sand_Corner',
    'Block_Sand_Reverse_Corner',
    'Block_Snow',
    'Block_Snow_Angle',
    'Block_Snow_Falling',
    'Block_Water',
]);

function cellKey(position: { x: number; z: number }) {
    return `${position.x}|${position.z}`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function createBounds({
    maxX,
    maxZ,
    minX,
    minZ,
    radius,
}: {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
    radius: number;
}): BeachBallBounceBounds | null {
    if (
        !Number.isFinite(minX) ||
        !Number.isFinite(maxX) ||
        !Number.isFinite(minZ) ||
        !Number.isFinite(maxZ)
    ) {
        return null;
    }

    const left = minX - obstacleHalfExtent + radius;
    const right = maxX + obstacleHalfExtent - radius;
    const bottom = minZ - obstacleHalfExtent + radius;
    const top = maxZ + obstacleHalfExtent - radius;

    return {
        minX: Math.min(left, right),
        maxX: Math.max(left, right),
        minZ: Math.min(bottom, top),
        maxZ: Math.max(bottom, top),
    };
}

function getBlockDataByName(
    blockData: BeachBallBlockDataLike[] | null | undefined,
) {
    return new Map(
        (blockData ?? []).map((entity) => [entity.information.name, entity]),
    );
}

function isPositionBlocked(
    position: { x: number; z: number },
    environment: BeachBallBounceEnvironment,
) {
    const { bounds, obstacles, radius } = environment;

    if (
        bounds &&
        (position.x < bounds.minX ||
            position.x > bounds.maxX ||
            position.z < bounds.minZ ||
            position.z > bounds.maxZ)
    ) {
        return true;
    }

    const expandedHalfExtent = obstacleHalfExtent + radius;
    return obstacles.some(
        (obstacle) =>
            Math.abs(position.x - obstacle.x) < expandedHalfExtent &&
            Math.abs(position.z - obstacle.z) < expandedHalfExtent,
    );
}

function resolveAxisMotion({
    axis,
    baseX,
    baseZ,
    currentOffsetX,
    currentOffsetZ,
    deltaSeconds,
    environment,
    nextOffset,
    velocity,
}: {
    axis: 'x' | 'z';
    baseX: number;
    baseZ: number;
    currentOffsetX: number;
    currentOffsetZ: number;
    deltaSeconds: number;
    environment: BeachBallBounceEnvironment;
    nextOffset: number;
    velocity: number;
}) {
    const nextOffsetX = axis === 'x' ? nextOffset : currentOffsetX;
    const nextOffsetZ = axis === 'z' ? nextOffset : currentOffsetZ;

    if (
        !isPositionBlocked(
            { x: baseX + nextOffsetX, z: baseZ + nextOffsetZ },
            environment,
        )
    ) {
        return {
            offset: nextOffset,
            velocity,
        };
    }

    const reflectedVelocity = -velocity * bounceRestitution;
    const reboundOffset =
        (axis === 'x' ? currentOffsetX : currentOffsetZ) +
        reflectedVelocity * deltaSeconds * reboundStepRatio;
    const reboundOffsetX = axis === 'x' ? reboundOffset : currentOffsetX;
    const reboundOffsetZ = axis === 'z' ? reboundOffset : currentOffsetZ;

    if (
        !isPositionBlocked(
            { x: baseX + reboundOffsetX, z: baseZ + reboundOffsetZ },
            environment,
        )
    ) {
        return {
            offset: reboundOffset,
            velocity: reflectedVelocity,
        };
    }

    return {
        offset: axis === 'x' ? currentOffsetX : currentOffsetZ,
        velocity: reflectedVelocity,
    };
}

export function isBeachBallPassableTerrainBlockName(name: string) {
    return passableTerrainBlockNames.has(name);
}

export function createBeachBallBounceState(): BeachBallBounceState {
    return {
        active: false,
        elapsedSeconds: 0,
        offsetX: 0,
        offsetZ: 0,
        velocityX: 0,
        velocityZ: 0,
    };
}

export function createBeachBallBounceEnvironment({
    blockData,
    movingBlockId,
    radius = beachBallCollisionRadius,
    stacks,
}: {
    blockData?: BeachBallBlockDataLike[] | null;
    movingBlockId: string;
    radius?: number;
    stacks?: Stack[];
}): BeachBallBounceEnvironment {
    const blockDataByName = getBlockDataByName(blockData);
    const obstaclesByKey = new Map<string, BeachBallBounceObstacle>();
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const stack of stacks ?? []) {
        minX = Math.min(minX, stack.position.x);
        maxX = Math.max(maxX, stack.position.x);
        minZ = Math.min(minZ, stack.position.z);
        maxZ = Math.max(maxZ, stack.position.z);

        for (const block of stack.blocks) {
            if (
                block.id === movingBlockId ||
                isBeachBallPassableTerrainBlockName(block.name)
            ) {
                continue;
            }

            for (const offset of getGardenBlockFootprintOffsets(
                blockDataByName.get(block.name),
                block.rotation,
            )) {
                const obstacle = {
                    x: stack.position.x + offset.x,
                    z: stack.position.z + offset.y,
                };
                obstaclesByKey.set(cellKey(obstacle), obstacle);
            }
        }
    }

    return {
        bounds: createBounds({ minX, maxX, minZ, maxZ, radius }),
        obstacles: Array.from(obstaclesByKey.values()),
        radius,
    };
}

export function advanceBeachBallBounce(
    state: BeachBallBounceState,
    environment: BeachBallBounceEnvironment,
    options: {
        baseX: number;
        baseZ: number;
        deltaSeconds: number;
    },
): BeachBallBounceState {
    if (!state.active) {
        return state;
    }

    const deltaSeconds = clamp(options.deltaSeconds, 0, maxFrameDeltaSeconds);
    const elapsedSeconds = state.elapsedSeconds + deltaSeconds;
    let offsetX = state.offsetX;
    let offsetZ = state.offsetZ;
    let velocityX = state.velocityX;
    let velocityZ = state.velocityZ;

    const xMotion = resolveAxisMotion({
        axis: 'x',
        baseX: options.baseX,
        baseZ: options.baseZ,
        currentOffsetX: offsetX,
        currentOffsetZ: offsetZ,
        deltaSeconds,
        environment,
        nextOffset: offsetX + velocityX * deltaSeconds,
        velocity: velocityX,
    });
    offsetX = xMotion.offset;
    velocityX = xMotion.velocity;

    const zMotion = resolveAxisMotion({
        axis: 'z',
        baseX: options.baseX,
        baseZ: options.baseZ,
        currentOffsetX: offsetX,
        currentOffsetZ: offsetZ,
        deltaSeconds,
        environment,
        nextOffset: offsetZ + velocityZ * deltaSeconds,
        velocity: velocityZ,
    });
    offsetZ = zMotion.offset;
    velocityZ = zMotion.velocity;

    const damping = velocityDampingPerSecond ** deltaSeconds;
    velocityX *= damping;
    velocityZ *= damping;

    const speed = Math.hypot(velocityX, velocityZ);
    const active =
        speed > minimumActiveSpeed && elapsedSeconds < maxMotionSeconds;

    return {
        active,
        elapsedSeconds,
        offsetX,
        offsetZ,
        velocityX: active ? velocityX : 0,
        velocityZ: active ? velocityZ : 0,
    };
}
