import { Box3, type Ray } from 'three';
import { GardenCellMap } from './GardenCellMap';

export type GardenSpatialEntry<T> = {
    bounds: Box3;
    key: string;
    order: number;
    value: T;
};

/** Conservative X/Z chunk broad phase; callers retain their exact narrow phase. */
export class GardenSpatialIndex<T> {
    private chunks = new GardenCellMap<GardenSpatialEntry<T>>();
    private entries = new Map<string, GardenSpatialEntry<T>>();
    // An expanding envelope avoids scanning every entry after an edge removal.
    private envelope = new Box3();
    version = 0;
    readonly metrics = {
        candidates: 0,
        chunksVisited: 0,
        entryUpdates: 0,
        rebuilds: 0,
        queries: 0,
        queryTotalMs: 0,
        staleVersionRejections: 0,
    };

    constructor(readonly chunkSize = 4) {
        if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
            throw new Error('Spatial chunk size must be positive');
        }
    }

    private visitBounds(bounds: Box3, visit: (x: number, z: number) => void) {
        for (
            let x = Math.floor(bounds.min.x / this.chunkSize);
            x <= Math.floor(bounds.max.x / this.chunkSize);
            x++
        ) {
            for (
                let z = Math.floor(bounds.min.z / this.chunkSize);
                z <= Math.floor(bounds.max.z / this.chunkSize);
                z++
            )
                visit(x, z);
        }
    }

    upsert(entry: GardenSpatialEntry<T>) {
        const previous = this.entries.get(entry.key);
        if (previous?.bounds.equals(entry.bounds)) {
            // Ordering and payload may change without touching chunk membership.
            if (
                previous.value !== entry.value ||
                previous.order !== entry.order
            )
                this.version++;
            previous.value = entry.value;
            previous.order = entry.order;
            return;
        }
        if (previous) this.remove(entry.key);
        const stored = { ...entry, bounds: entry.bounds.clone() };
        this.entries.set(entry.key, stored);
        this.visitBounds(stored.bounds, (x, z) =>
            this.chunks.add(x, z, stored),
        );
        this.envelope.union(stored.bounds);
        this.metrics.entryUpdates++;
        this.version++;
    }

    remove(key: string) {
        const entry = this.entries.get(key);
        if (!entry) return;
        this.visitBounds(entry.bounds, (x, z) =>
            this.chunks.remove(x, z, entry),
        );
        this.entries.delete(key);
        if (this.entries.size === 0) this.envelope.makeEmpty();
        this.metrics.entryUpdates++;
        this.version++;
    }

    keys() {
        return this.entries.keys();
    }

    queryPoint(x: number, z: number) {
        return this.chunks
            .get(Math.floor(x / this.chunkSize), Math.floor(z / this.chunkSize))
            .filter(
                ({ bounds }) =>
                    x >= bounds.min.x &&
                    x <= bounds.max.x &&
                    z >= bounds.min.z &&
                    z <= bounds.max.z,
            )
            .toSorted((a, b) => a.order - b.order)
            .map(({ value }) => value);
    }

    queryRay(ray: Ray, expectedVersion = this.version): T[] {
        if (expectedVersion !== this.version) {
            this.metrics.staleVersionRejections++;
            throw new Error('Stale garden spatial query');
        }
        const started = performance.now();
        const found = new Set<GardenSpatialEntry<T>>();
        this.metrics.queries++;
        // Slab clipping also handles rays starting inside the garden and vertical rays.
        let enter = 0;
        let exit = Number.POSITIVE_INFINITY;
        for (const axis of ['x', 'y', 'z'] as const) {
            const origin = ray.origin[axis];
            const direction = ray.direction[axis];
            if (direction === 0) {
                if (
                    origin < this.envelope.min[axis] ||
                    origin > this.envelope.max[axis]
                )
                    exit = -1;
            } else {
                const a = (this.envelope.min[axis] - origin) / direction;
                const b = (this.envelope.max[axis] - origin) / direction;
                enter = Math.max(enter, Math.min(a, b));
                exit = Math.min(exit, Math.max(a, b));
            }
        }
        if (!this.envelope.isEmpty() && exit >= enter) {
            const size = this.chunkSize;
            let x = Math.floor((ray.origin.x + ray.direction.x * enter) / size);
            let z = Math.floor((ray.origin.z + ray.direction.z * enter) / size);
            const stepX = Math.sign(ray.direction.x);
            const stepZ = Math.sign(ray.direction.z);
            const deltaX =
                stepX === 0 ? Infinity : size / Math.abs(ray.direction.x);
            const deltaZ =
                stepZ === 0 ? Infinity : size / Math.abs(ray.direction.z);
            let nextX =
                stepX === 0
                    ? Infinity
                    : ((x + (stepX > 0 ? 1 : 0)) * size - ray.origin.x) /
                      ray.direction.x;
            let nextZ =
                stepZ === 0
                    ? Infinity
                    : ((z + (stepZ > 0 ? 1 : 0)) * size - ray.origin.z) /
                      ray.direction.z;
            const visit = (cx: number, cz: number) => {
                this.metrics.chunksVisited++;
                for (const entry of this.chunks.get(cx, cz)) found.add(entry);
            };
            while (true) {
                visit(x, z);
                const next = Math.min(nextX, nextZ);
                if (!Number.isFinite(next) || next > exit) break;
                // Supercover ties: include both neighbours at an exact chunk corner.
                if (nextX === nextZ) {
                    visit(x + stepX, z);
                    visit(x, z + stepZ);
                }
                if (nextX === next) {
                    x += stepX;
                    nextX += deltaX;
                }
                if (nextZ === next) {
                    z += stepZ;
                    nextZ += deltaZ;
                }
            }
        }
        this.metrics.candidates += found.size;
        // Preserve original garden order, including exact-distance ties.
        const result = [...found]
            .sort((a, b) => a.order - b.order)
            .map(({ value }) => value);
        this.metrics.queryTotalMs += performance.now() - started;
        return result;
    }
}
