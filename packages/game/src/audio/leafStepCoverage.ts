import type { GardenAvatarPoint } from '../entities/avatar/gardenAvatarMovement';
import type { AutumnLeafBatchData } from '../scene/autumnAccumulation';

type LeafContact = {
    x: number;
    y: number;
    z: number;
    gradientX: number;
    gradientZ: number;
    tileX: number;
    tileZ: number;
};
const contactRadius = 0.3;

/** Index only allocated, rendered ground clusters, including the tier's cap.
 * Props never register. Each scene owns its index; no garden data is changed.
 */
export function createLeafStepCoverage() {
    const cells = new Map<string, Set<LeafContact>>();
    const key = (x: number, z: number) => `${Math.floor(x)}:${Math.floor(z)}`;
    return {
        register(batches: readonly AutumnLeafBatchData[]) {
            const registered: Array<{ key: string; contact: LeafContact }> = [];
            for (const batch of batches) {
                for (const instance of batch.instances) {
                    const [x, y, z] = instance.position;
                    const angle = (instance.rotation * Math.PI) / 2;
                    const contact = {
                        x,
                        y: y - 0.012,
                        z,
                        tileX: instance.stack.position.x,
                        tileZ: instance.stack.position.z,
                        gradientX:
                            batch.gradientX * Math.cos(angle) +
                            batch.gradientZ * Math.sin(angle),
                        gradientZ:
                            -batch.gradientX * Math.sin(angle) +
                            batch.gradientZ * Math.cos(angle),
                    };
                    const cellKey = key(x, z);
                    const cell = cells.get(cellKey) ?? new Set<LeafContact>();
                    cell.add(contact);
                    cells.set(cellKey, cell);
                    registered.push({ key: cellKey, contact });
                }
            }
            return () => {
                for (const entry of registered) {
                    const cell = cells.get(entry.key);
                    cell?.delete(entry.contact);
                    if (cell?.size === 0) cells.delete(entry.key);
                }
            };
        },
        hasLeaves({ x, y, z }: GardenAvatarPoint) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const cell = cells.get(key(x + dx, z + dz));
                    if (!cell) continue;
                    for (const leaf of cell) {
                        const offsetX = x - leaf.x;
                        const offsetZ = z - leaf.z;
                        const surfaceY =
                            leaf.y +
                            leaf.gradientX * offsetX +
                            leaf.gradientZ * offsetZ;
                        if (
                            Math.abs(x - leaf.tileX) <= 0.5 &&
                            Math.abs(z - leaf.tileZ) <= 0.5 &&
                            offsetX ** 2 + offsetZ ** 2 <= contactRadius ** 2 &&
                            Math.abs(y - surfaceY) < 0.08
                        )
                            return true;
                    }
                }
            }
            return false;
        },
    };
}
