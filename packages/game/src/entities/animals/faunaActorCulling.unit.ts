import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BoxGeometry,
    Frustum,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    OrthographicCamera,
    SkinnedMesh,
} from 'three';
import {
    configureFaunaActorCulling,
    faunaCullingBoundsScale,
} from './faunaActorCulling';

function createActor() {
    const root = new Group();
    const body = new SkinnedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial(),
    );
    body.frustumCulled = false;
    const head = new Mesh(
        new BoxGeometry(0.4, 0.4, 0.4),
        new MeshBasicMaterial(),
    );
    head.frustumCulled = false;
    head.position.set(0, 0.8, 0.4);
    const spots = new InstancedMesh(
        new BoxGeometry(0.1, 0.1, 0.1),
        new MeshBasicMaterial(),
        2,
    );
    spots.frustumCulled = false;
    root.add(body, head, spots);
    return { body, head, root, spots };
}

function cameraFrustum() {
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    return new Frustum().setFromProjectionMatrix(
        new Matrix4().multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
        ),
    );
}

function renderMesh(mesh: Mesh) {
    // Only the hook chain is under test; three's arguments are not read.
    Reflect.apply(mesh.onBeforeRender, mesh, []);
}

test('fauna culling re-enables frustum culling with conservative bounds', () => {
    const { body, head, root, spots } = createActor();
    const culling = configureFaunaActorCulling(root);

    assert.equal(culling.meshCount, 2);
    assert.equal(body.frustumCulled, true);
    assert.equal(head.frustumCulled, true);
    assert.equal(spots.frustumCulled, false, 'instanced meshes stay untouched');

    const geometryRadius = body.geometry.boundingSphere?.radius ?? 0;
    assert.ok(geometryRadius > 0);
    assert.equal(
        body.boundingSphere?.radius,
        geometryRadius * faunaCullingBoundsScale,
    );
    assert.equal(
        body.geometry.boundingSphere?.radius,
        geometryRadius,
        'shared geometry bounds stay exact for raycasting',
    );
});

test('fauna culling keeps nearby actors and culls distant ones', () => {
    const frustum = cameraFrustum();
    const { body, root } = createActor();
    configureFaunaActorCulling(root);

    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    assert.equal(frustum.intersectsObject(body), true);

    // Just outside the view edge, within the conservative margin.
    root.position.set(5.9, 0, 0);
    root.updateMatrixWorld(true);
    assert.equal(frustum.intersectsObject(body), true);

    root.position.set(30, 0, 0);
    root.updateMatrixWorld(true);
    assert.equal(frustum.intersectsObject(body), false);
});

test('fauna culling reports renders once per check', () => {
    const { head, root } = createActor();
    let previousHookCalls = 0;
    head.onBeforeRender = () => {
        previousHookCalls += 1;
    };
    const culling = configureFaunaActorCulling(root);

    assert.equal(culling.consumeRendered(), true, 'first pose is applied');
    assert.equal(culling.consumeRendered(), false);

    renderMesh(head);
    assert.equal(previousHookCalls, 1, 'existing render hooks still run');
    assert.equal(culling.consumeRendered(), true);
    assert.equal(culling.consumeRendered(), false);
});

test('fauna culling configuration is idempotent per model', () => {
    const { head, root } = createActor();
    const first = configureFaunaActorCulling(root);
    const hook = head.onBeforeRender;

    assert.equal(configureFaunaActorCulling(root), first);
    assert.equal(head.onBeforeRender, hook);
});
