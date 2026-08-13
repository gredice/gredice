import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    legacyStoneCornerStairsBlockName,
    resolveCurrentTerrainBlockName,
    stoneCornerStairsBlockName,
} from './terrainStairs';

describe('terrain stair compatibility', () => {
    it('uses current corner-stair media for the legacy half-stair name', () => {
        assert.equal(
            resolveCurrentTerrainBlockName(legacyStoneCornerStairsBlockName),
            stoneCornerStairsBlockName,
        );
        assert.equal(
            resolveCurrentTerrainBlockName(
                'Block_Polished_Stone_Stairs_Corner',
            ),
            'Block_Polished_Stone_Stairs_Corner',
        );
    });
});
