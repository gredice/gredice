import * as THREE from 'three';

const STEM_RADIAL_SEGMENTS = 5;
const SHARED_TOPOLOGY_ATTRIBUTE_NAMES = ['position', 'normal'] as const;

function createStemTopologyTemplate() {
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let ringIndex = 0; ringIndex <= 1; ringIndex += 1) {
        const y = ringIndex;

        for (
            let radialIndex = 0;
            radialIndex <= STEM_RADIAL_SEGMENTS;
            radialIndex += 1
        ) {
            const angle = (radialIndex / STEM_RADIAL_SEGMENTS) * Math.PI * 2;
            const x = Math.cos(angle);
            const z = Math.sin(angle);

            vertices.push(x, y, z);
            normals.push(x, 0, z);
        }
    }

    const ringSize = STEM_RADIAL_SEGMENTS + 1;
    for (
        let radialIndex = 0;
        radialIndex < STEM_RADIAL_SEGMENTS;
        radialIndex += 1
    ) {
        const a = radialIndex;
        const b = ringSize + radialIndex;
        const c = radialIndex + 1;
        const d = ringSize + radialIndex + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setIndex(indices);
    return geometry;
}

// The indexed five-sided topology is immutable and shared by every stem batch.
// Each batch still needs its own geometry shell because stemRadius is mutable
// instance data and must never be overwritten by another mounted batch.
const stemTopologyTemplate = createStemTopologyTemplate();

export function createPlantStemGeometryShell() {
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(stemTopologyTemplate.index);

    for (const attributeName of SHARED_TOPOLOGY_ATTRIBUTE_NAMES) {
        geometry.setAttribute(
            attributeName,
            stemTopologyTemplate.getAttribute(attributeName),
        );
    }

    return geometry;
}

export function disposePlantStemGeometryShell(geometry: THREE.BufferGeometry) {
    if (geometry.index === stemTopologyTemplate.index) {
        geometry.setIndex(null);
    }

    for (const attributeName of SHARED_TOPOLOGY_ATTRIBUTE_NAMES) {
        if (
            geometry.getAttribute(attributeName) ===
            stemTopologyTemplate.getAttribute(attributeName)
        ) {
            geometry.deleteAttribute(attributeName);
        }
    }

    geometry.dispose();
}
