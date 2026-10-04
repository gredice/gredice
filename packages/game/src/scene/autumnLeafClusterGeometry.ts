import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Quaternion,
    Vector3,
} from 'three';
import { createAutumnLeafGeometry } from './autumnLeafGeometry';

export function createAutumnLeafClusterGeometry(
    gradientX: number,
    gradientZ: number,
    variant: number,
) {
    const positions: number[] = [];
    const colors: number[] = [];
    for (const [index, hex] of ['#c39635', '#b96634', '#845237'].entries()) {
        const source = createAutumnLeafGeometry();
        const leaf = source.toNonIndexed();
        source.dispose();
        leaf.scale(0.8, 0.8, 0.8);
        leaf.rotateX(-Math.PI / 2);
        leaf.rotateY(index * 2.3);
        leaf.translate((index - 1) * 0.045, index * 0.006, (index % 2) * 0.03);
        positions.push(...leaf.attributes.position.array);
        const color = new Color(hex);
        for (let vertex = 0; vertex < leaf.attributes.position.count; vertex++)
            colors.push(color.r, color.g, color.b);
        leaf.dispose();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.rotateY((variant * Math.PI) / 2);
    geometry.applyQuaternion(
        new Quaternion().setFromUnitVectors(
            new Vector3(0, 1, 0),
            new Vector3(-gradientX, 1, -gradientZ).normalize(),
        ),
    );
    geometry.computeVertexNormals();
    return geometry;
}
