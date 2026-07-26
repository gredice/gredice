import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
    createPlantStemGeometryShell,
    disposePlantStemGeometryShell,
} from './plantStemGeometry';

describe('plant stem geometry', () => {
    it('keeps the shared five-sided topology at ten triangles', () => {
        const geometry = createPlantStemGeometryShell();

        assert.equal(geometry.getAttribute('position').count, 12);
        assert.equal(geometry.index?.count, 30);
        assert.equal((geometry.index?.count ?? 0) / 3, 10);

        disposePlantStemGeometryShell(geometry);
    });

    it('shares immutable topology while keeping instance radii batch-local', () => {
        const first = createPlantStemGeometryShell();
        const second = createPlantStemGeometryShell();
        const radius = new THREE.InstancedBufferAttribute(
            new Float32Array([0.1, 0.05]),
            2,
        );

        first.setAttribute('stemRadius', radius);

        assert.equal(first.index, second.index);
        assert.equal(
            first.getAttribute('position'),
            second.getAttribute('position'),
        );
        assert.equal(
            first.getAttribute('normal'),
            second.getAttribute('normal'),
        );
        assert.equal(first.getAttribute('stemRadius'), radius);
        assert.equal(second.getAttribute('stemRadius'), undefined);

        disposePlantStemGeometryShell(first);
        disposePlantStemGeometryShell(second);
    });
});
