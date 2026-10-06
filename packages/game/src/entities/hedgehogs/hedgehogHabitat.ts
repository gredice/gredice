import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/stackHeightCore';
import {
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
} from '../animals/animalMovementTerrain';
import { findSquirrelPath } from '../squirrels/squirrelPathfinding';
import { hashSquirrelSeed } from '../squirrels/squirrelSpawning';

export type HedgehogHabitat = {
    id: string;
    revision: string;
    portal: Vector3;
    approach: Vector3;
    routes: Vector3[][];
};
const bodyClearance = 0.26;
const key = (p: { x: number; z: number }) =>
    `${Math.round(p.x)}:${Math.round(p.z)}`;

export function createHedgehogHabitats({
    stacks,
    blockData,
    gardenSeed,
}: {
    stacks: Stack[] | undefined;
    blockData: BlockData[] | null | undefined;
    gardenSeed: string;
}): HedgehogHabitat[] {
    const surfaces = createAnimalMovementSurfaces({
        stacks,
        blockData,
        groundLift: 0.008,
        swimDepth: 0,
    });
    const blockedCells = createAnimalBlockedCells(stacks, {
        blockData,
        blockWater: true,
    });
    const blocked = new Set(blockedCells.map(key));
    const homes = (stacks ?? [])
        .flatMap((stack) => {
            const block = stack.blocks.at(-1);
            return block?.name === 'HedgehogShelter' ? [{ stack, block }] : [];
        })
        .sort(
            (a, b) =>
                hashSquirrelSeed(`${gardenSeed}:${a.block.id}`) -
                hashSquirrelSeed(`${gardenSeed}:${b.block.id}`),
        )
        .slice(0, 8);
    for (const { stack, block } of homes) {
        const height = getStackHeight(blockData, stack, block);
        const rotation = (block.rotation * Math.PI) / 2;
        const local = (z: number, y: number) =>
            new Vector3(0, y, z)
                .applyAxisAngle(new Vector3(0, 1, 0), rotation)
                .add(new Vector3(stack.position.x, height, stack.position.z));
        const portal = local(-0.15, 0.035);
        const approach = local(-0.8, 0.008);
        const ground = getAnimalMovementSurfaceAt(approach, surfaces);
        // A raised/water-facing shelter remains decorative until a level ground entrance exists.
        if (
            ground?.kind !== 'ground' ||
            blocked.has(key(approach)) ||
            Math.abs(ground.y - approach.y) > 0.025
        )
            continue;
        // A short visit never needs the full garden in each path search.
        const localSurfaces = surfaces.filter(
            (s) =>
                Math.abs(s.x - stack.position.x) <= 4 &&
                Math.abs(s.z - stack.position.z) <= 4,
        );
        const localBlockedCells = blockedCells.filter(
            (s) =>
                Math.abs(s.x - stack.position.x) <= 5 &&
                Math.abs(s.z - stack.position.z) <= 5,
        );
        const candidates = localSurfaces
            .filter(
                (s) =>
                    s.kind === 'ground' &&
                    !blocked.has(key(s)) &&
                    Math.hypot(s.x - approach.x, s.z - approach.z) >= 0.8 &&
                    Math.hypot(s.x - approach.x, s.z - approach.z) <= 2.5,
            )
            .sort(
                (a, b) =>
                    hashSquirrelSeed(`${block.id}:${key(a)}`) -
                    hashSquirrelSeed(`${block.id}:${key(b)}`),
            )
            .slice(0, 12);
        const routes: Vector3[][] = [];
        for (const target of candidates) {
            const path = findSquirrelPath({
                from: approach,
                to: target,
                surfaces: localSurfaces,
                blockedCells: localBlockedCells,
            });
            if (path.status === 'unreachable' || path.distance > 4) continue;
            let safe = true;
            for (let i = 1; i < path.points.length && safe; i++) {
                const from = path.points[i - 1];
                const to = path.points[i];
                if (!from || !to) continue;
                const steps = Math.ceil(
                    Math.hypot(to.x - from.x, to.z - from.z) / 0.08,
                );
                for (let j = 0; j <= steps && safe; j++) {
                    const t = j / Math.max(1, steps);
                    const x = from.x + (to.x - from.x) * t,
                        z = from.z + (to.z - from.z) * t,
                        y = from.y + (to.y - from.y) * t;
                    for (const dx of [-bodyClearance, 0, bodyClearance])
                        for (const dz of [-bodyClearance, 0, bodyClearance]) {
                            const p = { x: x + dx, z: z + dz };
                            const s = getAnimalMovementSurfaceAt(p, surfaces);
                            if (
                                blocked.has(key(p)) ||
                                s?.kind !== 'ground' ||
                                Math.abs(s.y - y) > 0.06
                            )
                                safe = false;
                        }
                }
            }
            if (safe)
                routes.push(path.points.map((p) => new Vector3(p.x, p.y, p.z)));
            if (routes.length === 3) break;
        }
        if (routes.length < 2) continue;
        return [
            {
                id: block.id,
                portal,
                approach,
                routes,
                revision: JSON.stringify([
                    portal.toArray(),
                    routes.map((r) => r.map((p) => p.toArray())),
                ]),
            },
        ];
    }
    return [];
}
