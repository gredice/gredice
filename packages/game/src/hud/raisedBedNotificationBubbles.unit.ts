import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { createGardenPosition } from '../types/Stack';
import { getRaisedBedNotificationAnchor } from './RaisedBedNotificationBubbles';

test('anchors one notification at the midpoint of a logical two-block raised bed', () => {
    const groundWest = { id: 'ground-west', name: 'Block_Grass', rotation: 0 };
    const raisedBedWest = { id: 'bed-west', name: 'Raised_Bed', rotation: 0 };
    const groundEast = { id: 'ground-east', name: 'Block_Grass', rotation: 0 };
    const raisedBedEast = { id: 'bed-east', name: 'Raised_Bed', rotation: 0 };
    const garden = {
        raisedBeds: [
            {
                blockId: raisedBedWest.id,
                id: 17,
            },
        ],
        stacks: [
            {
                blocks: [groundWest, raisedBedWest],
                position: createGardenPosition(0, 0, 3),
            },
            {
                blocks: [groundEast, raisedBedEast],
                position: createGardenPosition(1, 0, 3),
            },
        ],
    };

    assert.deepEqual(
        getRaisedBedNotificationAnchor(getLocalSandboxBlockData(), garden, 17),
        [0.5, 2.65, 3],
    );
});
