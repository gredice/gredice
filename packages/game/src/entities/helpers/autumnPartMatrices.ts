import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import type { AutumnPartLeafSurface } from './autumnLeafSurfaces';

const up = new Vector3(0, 1, 0);
const identity = new Quaternion();

/** Matrix input follows the live rendered part. Neither block placement nor
 * node/root transforms are reapplied by the leaf renderer.
 */
export function createAutumnPartLeafInstanceMatrix(
    batchRootWorld: Matrix4,
    renderedPartWorld: Matrix4,
    surface: AutumnPartLeafSurface,
) {
    const normal = up
        .clone()
        .applyMatrix3(new Matrix3().getNormalMatrix(renderedPartWorld))
        .normalize();
    if (!normal.toArray().every(Number.isFinite) || normal.y <= 0.2)
        return null;
    const [x, y, z] = surface.position;
    const scale = surface.scale ?? 0.45;
    const localAnchor = new Matrix4().compose(
        new Vector3(x, y + 0.006, z),
        identity,
        new Vector3(scale, scale, scale),
    );
    const matrix = new Matrix4()
        .copy(batchRootWorld)
        .invert()
        .multiply(renderedPartWorld)
        .multiply(localAnchor);
    return matrix.elements.every(Number.isFinite) ? matrix : null;
}
