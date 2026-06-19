import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    FEATURED_OPERATIONS_BY_STAGE,
    getPlantOperationRecommendationStages,
    PLANT_STATUS_STAGE_SEQUENCE,
    shouldShowPlantOperationRecommendations,
} from './featuredOperations';

describe('featured operations', () => {
    it('recommends dead plant fields like harvested plant fields', () => {
        assert.deepStrictEqual(
            PLANT_STATUS_STAGE_SEQUENCE.died,
            PLANT_STATUS_STAGE_SEQUENCE.harvested,
        );

        assert.deepStrictEqual(
            FEATURED_OPERATIONS_BY_STAGE[PLANT_STATUS_STAGE_SEQUENCE.died[0]],
            ['plantRemoval'],
        );
    });

    it('does not recommend operations when a plant has not sprouted', () => {
        assert.equal(
            shouldShowPlantOperationRecommendations('notSprouted'),
            false,
        );
        assert.equal(
            getPlantOperationRecommendationStages('notSprouted'),
            undefined,
        );
    });
});
