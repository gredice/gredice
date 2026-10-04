import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    animalAvatarFollowDistance,
    animalAvatarFollowSeconds,
    getAnimalAvatarFollowPosition,
    isFreshGardenAvatarPresence,
} from './animalAvatarFollowing';

describe('animal avatar following', () => {
    const presence = {
        position: { x: 4, y: 0.4, z: -2 },
        updatedAt: 10,
        yaw: Math.PI / 2,
    };

    it('keeps the one-minute follow contract explicit', () => {
        assert.equal(animalAvatarFollowSeconds, 60);
    });

    it('targets a point behind the moving avatar', () => {
        const target = getAnimalAvatarFollowPosition(presence);

        assert.ok(
            Math.abs(
                target.x - (presence.position.x + animalAvatarFollowDistance),
            ) < 0.000_001,
        );
        assert.equal(target.y, presence.position.y);
        assert.ok(Math.abs(target.z - presence.position.z) < 0.000_001);
    });

    it('rejects stale avatar positions while a modal or overview pauses play', () => {
        assert.equal(isFreshGardenAvatarPresence(presence, 10.4), true);
        assert.equal(isFreshGardenAvatarPresence(presence, 10.6), false);
        assert.equal(isFreshGardenAvatarPresence(null, 10), false);
    });
});
