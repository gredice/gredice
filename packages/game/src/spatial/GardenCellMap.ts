/** Garden coordinates use X/Z; placement keeps exact integer cell centres. */
export function gardenCellKey(x: number, z: number) {
    return `${x}|${z}`;
}

export class GardenCellMap<T> {
    private cells = new Map<string, T[]>();

    get(x: number, z: number): readonly T[] {
        return this.cells.get(gardenCellKey(x, z)) ?? [];
    }

    add(x: number, z: number, value: T) {
        const key = gardenCellKey(x, z);
        const entries = this.cells.get(key);
        if (entries) entries.push(value);
        else this.cells.set(key, [value]);
    }

    remove(x: number, z: number, value: T) {
        const key = gardenCellKey(x, z);
        const entries = this.cells.get(key);
        if (!entries) return;
        const index = entries.indexOf(value);
        if (index !== -1) entries.splice(index, 1);
        if (entries.length === 0) this.cells.delete(key);
    }
}
