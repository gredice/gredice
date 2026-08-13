import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { swampGroundDecorationTint } from './groundDecorations/groundDecorationConfig';
import {
    swampGroundBaseColor,
    swampGroundDecorationColor,
} from './swampGroundPalette';

describe('swamp ground palette', () => {
    it('shares an olive-brown soil color and light-brown decoration tint', () => {
        assert.equal(swampGroundBaseColor, '#5d6042');
        assert.equal(swampGroundDecorationColor, '#a58a58');
        assert.equal(swampGroundDecorationTint, swampGroundDecorationColor);
    });
});
