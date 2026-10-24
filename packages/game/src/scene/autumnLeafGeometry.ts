import { BufferGeometry, Float32BufferAttribute } from 'three';

/** Four broad facets with a raised midrib, shared by airborne and settled leaves. */
export function createAutumnLeafGeometry() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
            [0, 0.065, 0, -0.04, 0, 0, 0, -0.065, 0, 0.04, 0, 0, 0, 0, 0.012],
            3,
        ),
    );
    geometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
    geometry.computeVertexNormals();
    return geometry;
}
