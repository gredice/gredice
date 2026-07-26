import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Group, Line, Mesh, Points } from 'three';
import { suppressPlacementShadowCasters } from './placementShadowCasters';

describe('suppressPlacementShadowCasters', () => {
    it('suppresses nested caster objects and restores their exact state', () => {
        const root = new Group();
        const nested = new Group();
        const mesh = new Mesh();
        const line = new Line();
        const points = new Points();
        mesh.castShadow = true;
        line.castShadow = false;
        points.castShadow = true;
        nested.add(mesh, line);
        root.add(nested, points);

        const restore = suppressPlacementShadowCasters(root);

        assert.equal(mesh.castShadow, false);
        assert.equal(line.castShadow, false);
        assert.equal(points.castShadow, false);

        restore();
        assert.equal(mesh.castShadow, true);
        assert.equal(line.castShadow, false);
        assert.equal(points.castShadow, true);

        restore();
        assert.equal(mesh.castShadow, true);
        assert.equal(line.castShadow, false);
        assert.equal(points.castShadow, true);
    });
});
