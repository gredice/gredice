import { Vector3 } from 'three';
import type { Season } from '../../scene/seasonState';
import type { SquirrelBehavior } from './squirrelBehavior';
import type { SquirrelHabitat } from './squirrelHabitat';
import {
    pathHorizontalDistance,
    pathPositionAtDistance,
} from './squirrelMovement';
import { findSquirrelPath } from './squirrelPathfinding';
import { hashSquirrelSeed } from './squirrelSpawning';

export function squirrelCachingEnabled({
    season,
    enabled,
    reducedMotion,
    rain,
    snow,
}: {
    season: Season;
    enabled: boolean;
    reducedMotion: boolean;
    rain: number;
    snow: number;
}) {
    return (
        enabled &&
        !reducedMotion &&
        season === 'autumn' &&
        rain < 0.7 &&
        snow < 0.01
    );
}

// One brief presentation-only trip per existing visit, with no extra actors,
// inventory, cache objects or retries. Paths use the normal habitat collision map.
export function createSquirrelCachePlan(
    habitat: SquirrelHabitat,
    spawnSequence: number,
) {
    const candidates = habitat.roamTargets
        .filter((target) => {
            const distance = target.position.distanceTo(
                habitat.spawnTarget.position,
            );
            return distance >= 0.6 && distance <= 4;
        })
        .map((target) => ({
            target,
            rank: hashSquirrelSeed(
                `${habitat.seed}:${spawnSequence}:nut:${target.id}`,
            ),
        }))
        .sort(
            (a, b) => a.rank - b.rank || a.target.id.localeCompare(b.target.id),
        )
        .slice(0, 8);
    for (const { target } of candidates) {
        const pathfinding = findSquirrelPath({
            blockedCells: habitat.blockedCells,
            from: habitat.spawnTarget.position,
            surfaces: habitat.groundSurfaces,
            to: target.position,
        });
        if (pathfinding.status === 'unreachable') continue;
        const path = pathfinding.points.map(
            (point) => new Vector3(point.x, point.y, point.z),
        );
        const distance = pathHorizontalDistance(path);
        if (distance < 0.6 || distance > 6) continue;
        const forageSeconds = 2.2 + (habitat.seed % 7) * 0.1;
        const carrySeconds = distance / 1.02;
        const cacheSeconds = 2.4;
        const pauseSeconds = 1.8;
        return {
            path,
            distance,
            target,
            pathfinding,
            forageSeconds,
            carrySeconds,
            cacheSeconds,
            duration:
                forageSeconds + carrySeconds + cacheSeconds + pauseSeconds,
        };
    }
    return null;
}

export type SquirrelCachePlan = NonNullable<
    ReturnType<typeof createSquirrelCachePlan>
>;

export function sampleSquirrelCache(plan: SquirrelCachePlan, elapsed: number) {
    const carryStart = plan.forageSeconds;
    const cacheStart = carryStart + plan.carrySeconds;
    const pauseStart = cacheStart + plan.cacheSeconds;
    let phase: 'forage' | 'carry' | 'cache' | 'pause' = 'pause';
    if (elapsed < carryStart) phase = 'forage';
    else if (elapsed < cacheStart) phase = 'carry';
    else if (elapsed < pauseStart) phase = 'cache';
    let behavior: SquirrelBehavior = 'forage';
    if (phase === 'carry') behavior = 'scamper';
    else if (phase === 'pause') behavior = 'pause';
    const distance =
        plan.distance *
        Math.min(1, Math.max(0, (elapsed - carryStart) / plan.carrySeconds));
    return {
        phase,
        complete: elapsed >= plan.duration,
        behavior,
        position: pathPositionAtDistance(plan.path, distance),
        lookAt: pathPositionAtDistance(
            plan.path,
            Math.min(plan.distance, distance + 0.18),
        ),
        // Pick up near the end of foraging, then tuck the nut away while digging.
        nutScale:
            elapsed < carryStart - 0.35 || elapsed >= cacheStart + 1.4
                ? 0
                : Math.min(
                      1,
                      Math.max(0, (elapsed - carryStart + 0.35) / 0.2),
                      Math.max(0, (cacheStart + 1.4 - elapsed) / 0.45),
                  ),
    };
}
