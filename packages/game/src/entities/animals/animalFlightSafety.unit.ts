import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import {
    type AnimalFlightObstacle,
    createObstacleSafeFlightWaypoints,
    isAnimalFlightSegmentClear,
} from './animalFlightSafety';

describe('animal flight safety', () => {
    const obstacle = {
        blockIds: ['tree'],
        topY: 2,
        x: 1,
        z: 0,
    } satisfies AnimalFlightObstacle;

    it('rejects a direct segment through blocker volume', () => {
        assert.equal(
            isAnimalFlightSegmentClear({
                from: new Vector3(0, 0.8, 0),
                obstacles: [obstacle],
                to: new Vector3(2, 0.8, 0),
            }),
            false,
        );
    });

    it('routes above blockers and keeps every segment clear', () => {
        const from = new Vector3(0, 0.8, 0);
        const to = new Vector3(2, 0.8, 0);
        const waypoints = createObstacleSafeFlightWaypoints({
            from,
            obstacles: [obstacle],
            to,
        });

        assert.ok(waypoints.length >= 2);
        let cursor = from;
        for (const waypoint of waypoints) {
            assert.equal(
                isAnimalFlightSegmentClear({
                    from: cursor,
                    obstacles: [obstacle],
                    to: waypoint,
                }),
                true,
            );
            cursor = waypoint;
        }
        assert.ok(cursor.distanceTo(to) < 0.001);
    });

    it('allows a flower target on its own ignored host block', () => {
        const ignoredBlockIds = new Set(['tree']);
        assert.equal(
            isAnimalFlightSegmentClear({
                from: new Vector3(0, 2.6, 0),
                ignoredBlockIds,
                obstacles: [obstacle],
                to: new Vector3(1, 1.8, 0),
            }),
            true,
        );
    });
});
