import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
    readAnimalProfileCommandMetrics,
    recordAnimalProfileCommandAcknowledgement,
    resetAnimalProfileCommandMetrics,
    startAnimalProfileCommandMetrics,
} from './animalProfileCommandMetrics';

describe('animal profile command metrics', () => {
    beforeEach(() => resetAnimalProfileCommandMetrics());

    it('rejects natural behavior and stale command sequences', () => {
        assert.equal(
            recordAnimalProfileCommandAcknowledgement({
                actorId: 'cow-a',
                behavior: 'trot',
                moving: true,
                sequence: 1,
                species: 'Cow',
            }),
            false,
        );

        startAnimalProfileCommandMetrics({
            behavior: 'trot',
            sequence: 2,
            species: 'Cow',
        });
        assert.equal(
            recordAnimalProfileCommandAcknowledgement({
                actorId: 'cow-a',
                behavior: 'trot',
                moving: true,
                sequence: 1,
                species: 'Cow',
            }),
            false,
        );
        assert.equal(
            recordAnimalProfileCommandAcknowledgement({
                actorId: 'cow-a',
                behavior: 'idle',
                moving: false,
                sequence: 2,
                species: 'Cow',
            }),
            false,
        );
        assert.equal(
            readAnimalProfileCommandMetrics()
                .profileAnimalCommandAcknowledgementCount,
            0,
        );
    });

    it('latches unique acknowledgements and moving witnesses', () => {
        startAnimalProfileCommandMetrics({
            behavior: 'trot',
            sequence: 3,
            species: 'Cow',
        });
        for (const actorId of ['cow-b', 'cow-a', 'cow-a']) {
            assert.equal(
                recordAnimalProfileCommandAcknowledgement({
                    actorId,
                    behavior: 'trot',
                    moving: actorId === 'cow-a',
                    sequence: 3,
                    species: 'Cow',
                }),
                true,
            );
        }

        assert.deepEqual(readAnimalProfileCommandMetrics(), {
            profileAnimalCommandAcknowledgedIds: ['cow-a', 'cow-b'],
            profileAnimalCommandAcknowledgementCount: 2,
            profileAnimalCommandBehavior: 'trot',
            profileAnimalCommandMovingAcknowledgedIds: ['cow-a'],
            profileAnimalCommandMovingAcknowledgementCount: 1,
            profileAnimalCommandSequence: 3,
            profileAnimalCommandSpecies: 'Cow',
        });
    });
});
