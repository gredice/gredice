import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ParticleType, resolveBlockParticleType } from './ParticleSystem';

describe('resolveBlockParticleType', () => {
    it('uses water particles for both water styles', () => {
        assert.equal(
            resolveBlockParticleType('Block_Water'),
            ParticleType.Water,
        );
        assert.equal(
            resolveBlockParticleType('Block_Swamp_Water'),
            ParticleType.Water,
        );
    });

    it('uses stone particles for stone and gravel terrain', () => {
        for (const name of [
            'Block_Stone',
            'Block_Stone_Angle',
            'Block_Stone_Stairs',
            'Block_Stone_Stairs_Half',
            'Block_Gravel',
            'Block_Gravel_Angle',
        ]) {
            assert.equal(resolveBlockParticleType(name), ParticleType.Stone);
        }
    });
});
