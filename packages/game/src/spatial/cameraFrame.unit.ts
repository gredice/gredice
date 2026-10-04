import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    Box3,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    Sphere,
    Vector3,
} from 'three';
import { getCameraFrame } from './cameraFrame';

describe('shared camera frame', () => {
    it('reuses one frame/version/frustum until a real input changes', () => {
        const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
        camera.position.set(10, 10, 10);
        camera.lookAt(0, 0, 0);
        const frame = getCameraFrame(
            camera,
            { width: 800, height: 600 },
            [0, 0, 0],
        );
        const version = frame.version;
        for (let i = 0; i < 10; i++)
            assert.equal(getCameraFrame(camera), frame);
        assert.equal(frame.version, version);
        assert.equal(frame.metrics.rebuilds, 1);
        const position = new Vector3(2, 0, 1);
        assert.ok(
            frame
                .project(position, new Vector3())
                .distanceTo(position.clone().project(camera)) < 1e-14,
        );
        assert.equal(
            frame.intersectsSphere(new Sphere(position, 1)),
            frame.frustum.intersectsSphere(new Sphere(position, 1)),
        );
        frame.intersectsBox(new Box3(new Vector3(), new Vector3(1, 1, 1)));
        assert.equal(frame.metrics.projectionTests, 1);
        assert.equal(frame.metrics.frustumTests, 2);
        getCameraFrame(camera, { width: 600, height: 800 });
        assert.equal(frame.version, version + 1);
        getCameraFrame(camera, undefined, [1, 2, 3]);
        assert.equal(frame.version, version + 2);
        assert.deepEqual(frame.target.toArray(), [1, 2, 3]);
        camera.zoom = 2;
        camera.updateProjectionMatrix();
        getCameraFrame(camera);
        assert.equal(frame.zoom, 2);
        assert.equal(frame.version, version + 3);
    });

    it('observes same-tick camera and ancestor writes and rejects held stale versions', () => {
        const camera = new PerspectiveCamera(50, 1, 0.1, 100);
        const parent = new Object3D();
        parent.add(camera);
        camera.position.z = 10;
        const frame = getCameraFrame(camera);
        const version = frame.version;
        parent.position.x = 3;
        camera.position.y = 2;
        camera.rotation.y = 0.2;
        getCameraFrame(camera);
        assert.equal(frame.version, version + 1);
        assert.ok(frame.view.equals(camera.matrixWorldInverse));
        assert.throws(
            () => frame.project(new Vector3(), new Vector3(), version),
            /Stale/,
        );
        assert.equal(frame.metrics.staleVersionRejections, 1);
        assert.notEqual(getCameraFrame(camera.clone()), frame);
    });
});
