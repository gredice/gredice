import {
    Color,
    Float32BufferAttribute,
    IcosahedronGeometry,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
    Vector3,
} from 'three';
import { seasonalRoles } from '../../scene/seasonalRoles';

// Heights on the unit sphere where the acorn's cap starts to flare out of
// the body and where it reaches its full width.
const capStart = 0.1;
const capFull = 0.32;

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/** A point of the unit sphere moved onto the acorn: an egg-shaped body,
 * longer below, under a wider, flatter cap whose rim flares out. */
function acornPoint(point: Vector3) {
    const { x, y, z } = point;
    const cap = smoothstep(capStart, capFull, y);
    const bodyY = y < 0 ? y * 0.15 - 0.012 * y ** 4 : y * 0.105;
    const radius = 0.105 + (0.122 - 0.105) * cap;
    point.set(x * radius, bodyY + (0.03 + y * 0.085 - bodyY) * cap, z * radius);
}

export function createSquirrelNut(scene: Object3D) {
    const head = scene.getObjectByName('Squirrel_HeadPivot');
    if (!head) return null;
    // A detail-2 icosahedron (180 triangles) reshaped into an acorn: a
    // nut-caramel body under an acorn-cap top (GAME_ART.md seasonal roles),
    // one flat colour per triangle and smooth normals, so it reads as an
    // acorn and not as a brown ball next to the rust fur.
    const geometry = new IcosahedronGeometry(1, 2);
    const positions = geometry.getAttribute('position');
    const point = new Vector3();
    const heights: number[] = [];
    for (let index = 0; index < positions.count; index++) {
        point.fromBufferAttribute(positions, index);
        heights.push(point.y);
        acornPoint(point);
        positions.setXYZ(index, point.x, point.y, point.z);
    }
    const body = new Color(seasonalRoles.nutCaramel.albedo);
    const cap = new Color(seasonalRoles.acornCap.albedo);
    const colors: number[] = [];
    for (let index = 0; index < positions.count; index += 3) {
        const height =
            (heights[index] + heights[index + 1] + heights[index + 2]) / 3;
        const color = height > (capStart + capFull) / 2 ? cap : body;
        for (let corner = 0; corner < 3; corner++)
            colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    // Smooth normals: the geometry is non-indexed, so average the face
    // normals of every corner that shares a position.
    const sums = new Map<string, Vector3>();
    const key = (index: number) =>
        `${positions.getX(index).toFixed(5)},${positions.getY(index).toFixed(5)},${positions.getZ(index).toFixed(5)}`;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (let index = 0; index < positions.count; index += 3) {
        a.fromBufferAttribute(positions, index);
        b.fromBufferAttribute(positions, index + 1);
        c.fromBufferAttribute(positions, index + 2);
        const normal = c.sub(b).cross(a.sub(b));
        for (let corner = 0; corner < 3; corner++) {
            const id = key(index + corner);
            const sum = sums.get(id) ?? new Vector3();
            sums.set(id, sum.add(normal));
        }
    }
    const normals = geometry.getAttribute('normal');
    for (let index = 0; index < positions.count; index++) {
        const normal = sums.get(key(index))?.clone().normalize();
        if (normal) normals.setXYZ(index, normal.x, normal.y, normal.z);
    }
    geometry.computeBoundingSphere();
    const material = new MeshStandardMaterial({
        vertexColors: true,
        roughness: seasonalRoles.nutCaramel.roughness,
    });
    const nut = new Mesh(geometry, material);
    nut.name = 'Squirrel:DecorativeNut';
    // Exported head-local space (assets/scripts/party_animals/squirrel.py):
    // the muzzle reaches z -0.47 with its underside at y -0.155, so the nut
    // sits in the mouth under the front of the muzzle. Root yaw turns local
    // -Z into forward +Z.
    nut.position.set(0, -0.2, -0.44);
    nut.visible = false;
    nut.raycast = () => {};
    head.add(nut);
    return {
        mesh: nut,
        dispose() {
            nut.removeFromParent();
            geometry.dispose();
            material.dispose();
        },
    };
}
