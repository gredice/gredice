import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { swampGroundDecorationTint } from './groundDecorations/groundDecorationConfig';
import { swampGroundDecorationColor } from './swampGroundPalette';

describe('swamp ground palette', () => {
    it('shares a light-brown decoration tint', () => {
        assert.equal(swampGroundDecorationColor, '#a58a58');
        assert.equal(swampGroundDecorationTint, swampGroundDecorationColor);
    });
});
