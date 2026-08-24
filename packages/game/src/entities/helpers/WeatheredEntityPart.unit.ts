import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { WeatheredEntityPart } from './WeatheredEntityPart';

describe('WeatheredEntityPart', () => {
    it('preserves hidden source mesh visibility', () => {
        const node = new Mesh(
            new BoxGeometry(1, 1, 1),
            new MeshStandardMaterial(),
        );
        node.visible = false;

        const rendered = WeatheredEntityPart({ node });

        assert.equal(rendered.props.visible, false);
    });
});
