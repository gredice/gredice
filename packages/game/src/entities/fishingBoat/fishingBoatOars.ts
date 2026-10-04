import { BufferGeometry, Float32BufferAttribute } from 'three';

export type FishingBoatOarSide = 'port' | 'starboard';

export type FishingBoatOarPart = {
    geometry: BufferGeometry;
    pivot: [number, number, number];
    side: FishingBoatOarSide;
};

const oarSides = ['port', 'starboard'] satisfies FishingBoatOarSide[];

// The rowlock sits where an oar crosses the widest part of the hull, which is
// the boat origin plane.
const oarRowlockZ = 0;

/**
 * Splits the modelled oar pair into a port and a starboard half so each oar can
 * pivot around its own rowlock. The model ships both oars stowed inside the
 * hull as a single mesh, which can only be animated as one rigid group.
 */
export function splitFishingBoatOarGeometries(
    source: BufferGeometry,
): FishingBoatOarPart[] {
    const triangles = source.index ? source.toNonIndexed() : source;
    const position = triangles.getAttribute('position');
    const attributeNames = Object.keys(triangles.attributes);
    const buckets = new Map<FishingBoatOarSide, Map<string, number[]>>(
        oarSides.map((side) => [
            side,
            new Map(attributeNames.map((name) => [name, []])),
        ]),
    );

    for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
        const centerX =
            (position.getX(triangle) +
                position.getX(triangle + 1) +
                position.getX(triangle + 2)) /
            3;
        const bucket = buckets.get(centerX < 0 ? 'port' : 'starboard');
        for (const name of attributeNames) {
            const attribute = triangles.getAttribute(name);
            const values = bucket?.get(name);
            if (!values) {
                continue;
            }
            for (let vertex = triangle; vertex < triangle + 3; vertex += 1) {
                for (let item = 0; item < attribute.itemSize; item += 1) {
                    values.push(attribute.getComponent(vertex, item));
                }
            }
        }
    }

    const parts = oarSides.map((side) => {
        const geometry = new BufferGeometry();
        for (const name of attributeNames) {
            const attribute = triangles.getAttribute(name);
            geometry.setAttribute(
                name,
                new Float32BufferAttribute(
                    buckets.get(side)?.get(name) ?? [],
                    attribute.itemSize,
                    attribute.normalized,
                ),
            );
        }
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        const pivot: [number, number, number] = bounds
            ? [
                  (bounds.min.x + bounds.max.x) / 2,
                  (bounds.min.y + bounds.max.y) / 2,
                  oarRowlockZ,
              ]
            : [0, 0, 0];
        geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
        geometry.computeBoundingSphere();
        return { geometry, pivot, side };
    });

    if (source.index) {
        triangles.dispose();
    }

    return parts;
}
