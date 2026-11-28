import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Color, MeshStandardMaterial } from 'three';
import { dryGroundBaseColor } from '../dryGroundPalette';
import {
    applyGroundPatchMaterial,
    groundSurfaceColors,
} from './groundPatchMaterial';

function hexOf(material: MeshStandardMaterial) {
    return `#${material.color.getHexString()}`;
}

describe('ground patch material presets', () => {
    it('owns the colour of shared and code-coloured ground', () => {
        // Old colours, as the blocks and other callers still pass them in.
        const snow = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#f0f7ff', roughness: 1 }),
            'snow',
            {},
        );
        const swamp = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#5d6042', roughness: 1 }),
            'swampDirt',
            {},
        );
        const dry = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#493329', roughness: 1 }),
            'dryDirt',
            {},
        );
        const sandCorner = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#ab8a49', roughness: 0.8 }),
            'sand',
            {},
        );

        assert.equal(hexOf(snow), groundSurfaceColors.snow);
        assert.equal(hexOf(swamp), groundSurfaceColors.swampDirt);
        assert.equal(hexOf(dry), dryGroundBaseColor);
        assert.equal(hexOf(sandCorner), groundSurfaceColors.sand);
        for (const material of [snow, swamp, dry, sandCorner]) {
            assert.equal(material.roughness, 0.8);
        }
    });

    it('leaves model-coloured ground as authored', () => {
        const grass = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#16330a', roughness: 0.75 }),
            'grass',
            {},
        );
        const dirt = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#8c683d', roughness: 0.8 }),
            'dirt',
            {},
        );

        assert.equal(hexOf(grass), '#16330a');
        assert.equal(hexOf(dirt), '#8c683d');
        assert.equal(grass.roughness, 0.75);
    });

    it('keeps snow a tinted neutral and the other grounds warm', () => {
        const snow = new Color(groundSurfaceColors.snow);
        assert.ok(snow.b > snow.r, 'snow leans cool');
        assert.ok(snow.r < 0.95, 'snow is never pure white');
        for (const value of [
            groundSurfaceColors.sand,
            groundSurfaceColors.swampDirt,
            dryGroundBaseColor,
        ]) {
            const color = new Color(value);
            assert.ok(color.r > color.b, `${value} leans warm`);
        }
    });
});
