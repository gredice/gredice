import {
    type Box3,
    type Camera,
    Frustum,
    Matrix4,
    OrthographicCamera,
    type Sphere,
    Vector3,
} from 'three';

export class CameraFrame {
    readonly view = new Matrix4();
    readonly projection = new Matrix4();
    readonly viewProjection = new Matrix4();
    readonly frustum = new Frustum();
    readonly target = new Vector3();
    readonly viewport = { width: 0, height: 0 };
    zoom = 0;
    version = 0;
    readonly metrics = {
        reads: 0,
        rebuilds: 0,
        projectionTests: 0,
        frustumTests: 0,
        staleVersionRejections: 0,
    };

    update(
        camera: Camera,
        viewport?: { width: number; height: number },
        target?: readonly number[],
    ) {
        this.metrics.reads++;
        // Readers can run in events, layout effects, or after avatar camera writes.
        // Refresh ancestors too; frame priority alone cannot guarantee fresh matrices.
        camera.updateWorldMatrix(true, false);
        const zoom = camera instanceof OrthographicCamera ? camera.zoom : 0;
        const changed =
            this.version === 0 ||
            !this.view.equals(camera.matrixWorldInverse) ||
            !this.projection.equals(camera.projectionMatrix) ||
            this.zoom !== zoom ||
            (viewport &&
                (viewport.width !== this.viewport.width ||
                    viewport.height !== this.viewport.height)) ||
            (target &&
                (target[0] !== this.target.x ||
                    target[1] !== this.target.y ||
                    target[2] !== this.target.z));
        if (!changed) return this;
        this.view.copy(camera.matrixWorldInverse);
        this.projection.copy(camera.projectionMatrix);
        this.viewProjection.multiplyMatrices(this.projection, this.view);
        this.frustum.setFromProjectionMatrix(
            this.viewProjection,
            camera.coordinateSystem,
            camera.reversedDepth,
        );
        if (viewport) Object.assign(this.viewport, viewport);
        if (target)
            this.target.set(target[0] ?? 0, target[1] ?? 0, target[2] ?? 0);
        this.zoom = zoom;
        this.version++;
        this.metrics.rebuilds++;
        return this;
    }

    assertVersion(version: number) {
        if (this.version !== version) {
            this.metrics.staleVersionRejections++;
            throw new Error('Stale camera frame');
        }
    }

    project(position: Vector3, output: Vector3, version = this.version) {
        this.assertVersion(version);
        this.metrics.projectionTests++;
        return output.copy(position).applyMatrix4(this.viewProjection);
    }

    intersectsBox(bounds: Box3) {
        this.metrics.frustumTests++;
        return this.frustum.intersectsBox(bounds);
    }

    intersectsSphere(bounds: Sphere) {
        this.metrics.frustumTests++;
        return this.frustum.intersectsSphere(bounds);
    }
}

const frames = new WeakMap<Camera, CameraFrame>();

/** One frame per actual camera, isolated across canvases and camera replacement. */
export function getCameraFrame(
    camera: Camera,
    viewport?: { width: number; height: number },
    target?: readonly number[],
) {
    let frame = frames.get(camera);
    if (!frame) {
        frame = new CameraFrame();
        frames.set(camera, frame);
    }
    return frame.update(camera, viewport, target);
}
