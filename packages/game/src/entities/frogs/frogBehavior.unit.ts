import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import {
    chooseFrogEscapePlan,
    chooseFrogHopPlan,
    getFrogBlinkDelaySeconds,
    getFrogCroakDelaySeconds,
    getFrogDwellSeconds,
    getFrogHopDurationSeconds,
    getFrogHopMotion,
    isAvatarNearFrog,
} from './frogBehavior';
import type { FrogHabitat, FrogTarget } from './frogSpawning';

function target(x: number, z: number, kind: FrogTarget['kind']): FrogTarget {
    return {
        id: `${kind}-${x}:${z}`,
        kind,
        position: { x, y: kind === 'shallow-water' ? 0.36 : 0.42, z },
    };
}

function habitat(
    targets: FrogTarget[],
    blockedCells: { x: number; z: number }[] = [],
): FrogHabitat {
    const surfaces = targets.map(
        (item) =>
            ({
                habitat: 'wetland',
                kind: item.kind === 'shallow-water' ? 'water' : 'ground',
                sourceBlockName:
                    item.kind === 'shallow-water'
                        ? 'Block_Swamp_Water'
                        : 'Block_Swamp_Ground',
                waterDepth: item.kind === 'shallow-water' ? 1.05 : undefined,
                ...item.position,
            }) satisfies AnimalMovementSurface,
    );
    return {
        blockedCells,
        id: 'habitat',
        seed: 1,
        surfaces,
        targets,
        traversableCells: targets.map(({ position }) => ({
            x: position.x,
            z: position.z,
        })),
    };
}

describe('frog behavior', () => {
    it('keeps idle, blink, and croak cadence within bounded windows', () => {
        assert.equal(
            getFrogDwellSeconds(() => 0),
            3.5,
        );
        assert.equal(
            getFrogDwellSeconds(() => 1),
            9,
        );
        assert.equal(
            getFrogBlinkDelaySeconds(() => 0),
            2.8,
        );
        assert.equal(
            getFrogBlinkDelaySeconds(() => 1),
            7,
        );
        assert.equal(
            getFrogCroakDelaySeconds(() => 0),
            12,
        );
        assert.equal(
            getFrogCroakDelaySeconds(() => 1),
            30,
        );
    });

    it('includes crouched anticipation, a positive hop arc, and landing recovery', () => {
        const anticipation = getFrogHopMotion({
            distance: 2,
            escape: false,
            progress: 0.1,
        });
        const airborne = getFrogHopMotion({
            distance: 2,
            escape: false,
            progress: 0.5,
        });
        const landing = getFrogHopMotion({
            distance: 2,
            escape: false,
            progress: 0.9,
        });

        assert.equal(anticipation.phase, 'anticipating');
        assert.equal(anticipation.travelProgress, 0);
        assert.equal(airborne.phase, 'airborne');
        assert.ok(airborne.arcHeight > 0.2);
        assert.equal(landing.phase, 'landing');
        assert.equal(landing.travelProgress, 1);
    });

    it('makes escape hops quicker than ordinary hops', () => {
        assert.ok(
            getFrogHopDurationSeconds({ distance: 2, escape: true }) <
                getFrogHopDurationSeconds({ distance: 2, escape: false }),
        );
    });

    it('prefers a reachable shallow-water target', () => {
        const current = target(0, 0, 'wetland-ground');
        const wet = target(1, 0, 'shallow-water');
        const dry = target(0, 1, 'wetland-ground');
        const plan = chooseFrogHopPlan({
            currentTarget: current,
            from: current.position,
            habitat: habitat([current, wet, dry]),
            random: () => 0,
        });

        assert.equal(plan?.target.id, wet.id);
        assert.notEqual(plan?.pathfinding.status, 'unreachable');
    });

    it('never falls back through a blocker or missing wetland cells', () => {
        const current = target(0, 0, 'wetland-ground');
        const destination = target(2, 0, 'shallow-water');
        const plan = chooseFrogHopPlan({
            currentTarget: current,
            from: current.position,
            habitat: habitat([current, destination], [{ x: 1, z: 0 }]),
            random: () => 0,
        });

        assert.equal(plan, null);
    });

    it('chooses a safe reachable target farther from a nearby avatar', () => {
        const current = target(0, 0, 'wetland-ground');
        const near = target(1, 0, 'shallow-water');
        const far = target(2, 0, 'wetland-ground');
        const avatar = { x: -0.4, z: 0 };
        const plan = chooseFrogEscapePlan({
            avatar,
            currentTarget: current,
            from: current.position,
            habitat: habitat([current, near, far]),
        });

        assert.equal(
            isAvatarNearFrog({ avatar, frog: current.position }),
            true,
        );
        assert.equal(plan?.target.id, far.id);
        assert.notEqual(plan?.pathfinding.status, 'unreachable');
    });
});
