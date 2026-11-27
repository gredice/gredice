import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    Group,
    Mesh,
    MeshBasicMaterial,
    SkinnedMesh,
} from 'three';
import { createGhostTemplateSettler } from './ghostTemplateSettler';

/** A hidden template root, as `ExpandGhostTemplate` mounts it. */
function createTemplate() {
    const root = new Group();
    root.visible = false;
    // The group `Activity` hides when the template is frozen.
    const frozenWrapper = new Group();
    root.add(frozenWrapper);
    return { frozenWrapper, root };
}

function addMesh(parent: Group) {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    parent.add(mesh);
    return mesh;
}

describe('createGhostTemplateSettler', () => {
    it('collects the template parts and waits for them to hold still', () => {
        const { frozenWrapper, root } = createTemplate();
        addMesh(frozenWrapper);
        const settler = createGhostTemplateSettler();

        assert.equal(settler.collection === null, true);
        assert.equal(settler.collect(root), true);
        assert.equal(settler.collection?.kind, 'parts');
        assert.equal(settler.collect(root), false);
        assert.equal(settler.frozen, false);
    });

    it('collects again when an inner boundary resolves before freezing', () => {
        const { frozenWrapper, root } = createTemplate();
        addMesh(frozenWrapper);
        const settler = createGhostTemplateSettler();
        settler.collect(root);

        addMesh(frozenWrapper).position.set(0, 1, 0);
        assert.equal(settler.settle(root), 'changed');
        assert.equal(
            settler.collection?.kind === 'parts'
                ? settler.collection.parts.length
                : 0,
            2,
        );
        assert.equal(settler.settle(root), 'frozen');
        assert.equal(settler.frozen, true);
    });

    it('keeps waiting on an empty template, which may still be loading', () => {
        const { root } = createTemplate();
        const settler = createGhostTemplateSettler();

        assert.equal(settler.settle(root), 'changed');
        assert.deepEqual(settler.collection, {
            kind: 'fallback',
            reason: 'no-mesh',
        });
        assert.equal(settler.settle(root), 'waiting');
        assert.equal(settler.frozen, false);
    });

    it('freezes a skinned template, which cannot draw ghosts', () => {
        const { frozenWrapper, root } = createTemplate();
        frozenWrapper.add(
            new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial()),
        );
        const settler = createGhostTemplateSettler();

        assert.equal(settler.settle(root), 'changed');
        assert.equal(settler.settle(root), 'frozen');
        assert.deepEqual(settler.collection, {
            kind: 'fallback',
            reason: 'skinned-mesh',
        });
    });

    it('keeps the parts when a check runs after the freeze hid the template', () => {
        const { frozenWrapper, root } = createTemplate();
        addMesh(frozenWrapper);
        const settler = createGhostTemplateSettler();
        settler.collect(root);
        assert.equal(settler.settle(root), 'frozen');
        const frozenCollection = settler.collection;

        // `Activity mode="hidden"` commits before the check's timer is
        // cleared: the template now draws nothing.
        frozenWrapper.visible = false;

        assert.equal(settler.settle(root), 'frozen');
        assert.equal(settler.collect(root), false);
        assert.equal(settler.collection, frozenCollection);
        assert.equal(settler.collection?.kind, 'parts');
    });

    it('lifts the per-mesh instance cap when asked', () => {
        const settler = createGhostTemplateSettler({
            maxInstancesPerMesh: Number.POSITIVE_INFINITY,
        });
        assert.equal(settler.collect(null), false);
        assert.equal(settler.collection, null);
    });
});
