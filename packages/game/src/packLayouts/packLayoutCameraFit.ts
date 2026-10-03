import { type Box3, type OrthographicCamera, Vector3 } from 'three';
import { resolveCaptureCameraZoom } from '../controls/orthographicCameraFit';

/** Fit real model/footprint bounds into the unobscured, currently visible canvas. */
export function resolvePackLayoutCameraFit({
    bounds,
    camera,
    canvas,
    hudTop,
    viewportHeight,
    originalZoom,
}: {
    bounds: Box3;
    camera: OrthographicCamera;
    canvas: { top: number; left: number; width: number; height: number };
    hudTop: number;
    viewportHeight: number;
    originalZoom: number;
}) {
    const margin = 20;
    const top = Math.max(0, canvas.top) + margin;
    const bottom =
        Math.min(canvas.top + canvas.height, viewportHeight, hudTop) - margin;
    const width = canvas.width - margin * 2;
    const height = bottom - top;
    if (bounds.isEmpty() || width <= 0 || height <= 0) return null;
    const center = bounds.getCenter(new Vector3());
    const inverse = camera.quaternion.clone().invert();
    const viewBounds = {
        left: Infinity,
        right: -Infinity,
        bottom: Infinity,
        top: -Infinity,
    };
    for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
                const point = new Vector3(x, y, z)
                    .sub(center)
                    .applyQuaternion(inverse);
                viewBounds.left = Math.min(viewBounds.left, point.x);
                viewBounds.right = Math.max(viewBounds.right, point.x);
                viewBounds.bottom = Math.min(viewBounds.bottom, point.y);
                viewBounds.top = Math.max(viewBounds.top, point.y);
            }
    const zoom = resolveCaptureCameraZoom({
        bounds: viewBounds,
        cameraWidth: ((camera.right - camera.left) * width) / canvas.width,
        cameraHeight: ((camera.top - camera.bottom) * height) / canvas.height,
        padding: 0.9,
    });
    return zoom === null
        ? null
        : {
              target: center,
              zoom: Math.max(1, Math.min(originalZoom, zoom)),
              screenPosition: {
                  x: 0.5,
                  y: ((top + bottom) / 2 - canvas.top) / canvas.height,
              },
          };
}
