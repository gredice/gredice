import {
    Color,
    Float32BufferAttribute,
    IcosahedronGeometry,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
} from 'three';

export function createSquirrelNut(scene: Object3D) {
    const head = scene.getObjectByName('Squirrel_HeadPivot');
    if (!head) return null;
    const geometry = new IcosahedronGeometry(0.13, 0);
    const vertices = geometry.getAttribute('position');
    const colors: number[] = [];
    const shell = new Color('#7b3515');
    const hilum = new Color('#deb47b');
    for (let index = 0; index < vertices.count; index++) {
        const color = vertices.getY(index) < -0.055 ? hilum : shell;
        colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const material = new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.68,
    });
    const nut = new Mesh(geometry, material);
    nut.name = 'Squirrel:DecorativeNut';
    // Exported head-local space: the muzzle is (0, -0.02, -0.26),
    // the nose (0, 0, -0.41). Root yaw turns local -Z into forward +Z.
    nut.position.set(0, -0.14, -0.39);
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
