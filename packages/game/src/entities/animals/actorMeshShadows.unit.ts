import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { configureActorMeshShadows } from './actorMeshShadows';

test('actor meshes leave the primary map while preserving receiver policy', () => {
    const root = new Group();
    const nested = new Group();
    const body = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const wing = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    body.name = 'body';
    body.castShadow = true;
    wing.name = 'wing';
    wing.castShadow = true;
    nested.add(wing);
    root.add(body, nested);

    const result = configureActorMeshShadows(root, (mesh) => {
        mesh.receiveShadow = mesh.name !== 'wing';
    });

    assert.deepEqual(result, { primaryCasterCount: 0 });
    assert.equal(body.castShadow, false);
    assert.equal(body.receiveShadow, true);
    assert.equal(wing.castShadow, false);
    assert.equal(wing.receiveShadow, false);
});
