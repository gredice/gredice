import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, OrthographicCamera, Vector3 } from 'three';
import {
    getPreservedAngleCameraPosition,
    getScreenPositionAdjustedCameraTarget,
} from '../controls/GameCameraRig';
import { resolvePackLayoutCameraFit } from './packLayoutCameraFit';

for (const hudTop of [284, 185])
    test(`real orthographic corners fit above the measured ${hudTop}px HUD at each quarter turn`, () => {
        for (const turn of [0, 1, 2, 3]) {
            const camera = new OrthographicCamera(
                -195,
                195,
                325,
                -325,
                0,
                1000,
            );
            camera.position.set(-8, 8, -8);
            camera.zoom = 65;
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);
            const corners = [
                new Vector3(-0.8, 0.42, -0.8),
                new Vector3(3.2, 2.2, 3.2),
            ].map((p) =>
                p.applyAxisAngle(new Vector3(0, 1, 0), (turn * Math.PI) / 2),
            );
            const bounds = new Box3().setFromPoints(corners);
            const fit = resolvePackLayoutCameraFit({
                bounds,
                camera,
                canvas: { left: 0, top: 0, width: 390, height: 650 },
                hudTop,
                viewportHeight: 650,
                originalZoom: 65,
            });
            assert.ok(fit);
            const target = getScreenPositionAdjustedCameraTarget({
                camera,
                focusTarget: fit.target,
                screenPosition: fit.screenPosition,
                viewportHeight: 650,
                viewportWidth: 390,
                zoom: fit.zoom,
            });
            camera.position.copy(
                getPreservedAngleCameraPosition({
                    cameraPosition: camera.position,
                    cameraTarget: new Vector3(),
                    focusTarget: target,
                }),
            );
            camera.lookAt(target);
            camera.zoom = fit.zoom;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);
            for (const x of [bounds.min.x, bounds.max.x])
                for (const y of [bounds.min.y, bounds.max.y])
                    for (const z of [bounds.min.z, bounds.max.z]) {
                        const projected = new Vector3(x, y, z).project(camera);
                        const screen = {
                            x: (projected.x + 1) * 195,
                            y: (1 - projected.y) * 325,
                        };
                        assert.ok(screen.x >= 20 && screen.x <= 370);
                        assert.ok(screen.y >= 20 && screen.y <= hudTop - 20);
                    }
        }
    });
test('no usable canvas or no rendered bounds cannot claim a fitting', () => {
    const camera = new OrthographicCamera(-195, 195, 325, -325);
    const input = {
        bounds: new Box3(new Vector3(), new Vector3(1, 1, 1)),
        camera,
        canvas: { left: 0, top: 0, width: 390, height: 650 },
        hudTop: 20,
        viewportHeight: 650,
        originalZoom: 65,
    };
    assert.equal(resolvePackLayoutCameraFit(input), null);
    assert.equal(
        resolvePackLayoutCameraFit({
            ...input,
            hudTop: 284,
            bounds: new Box3(),
        }),
        null,
    );
});

test('a viewport requiring zoom below the rig minimum remains unframed', () => {
    const camera = new OrthographicCamera(-195, 195, 325, -325);
    camera.position.set(-8, 8, -8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const fit = resolvePackLayoutCameraFit({
        bounds: new Box3(new Vector3(-2, 0, -2), new Vector3(2, 2, 2)),
        camera,
        canvas: { left: 0, top: 0, width: 390, height: 650 },
        hudTop: 40.5,
        viewportHeight: 650,
        originalZoom: 65,
    });
    assert.equal(fit, null);
});
