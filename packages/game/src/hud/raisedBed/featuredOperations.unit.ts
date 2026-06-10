import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    FEATURED_OPERATIONS_BY_STAGE,
    PLANT_STATUS_STAGE_SEQUENCE,
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
});
