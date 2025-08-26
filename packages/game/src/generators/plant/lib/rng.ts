// A simple seeded pseudo-random number generator (LCG)
export class SeededRNG {
    private seed: number;

    constructor(seed: string) {
        this.seed = this.hashCode(seed);
    }

    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    // Returns a float between 0 (inclusive) and 1 (exclusive)
    nextFloat(): number {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    // Returns a float between min (inclusive) and max (exclusive)
    nextRange(min: number, max: number): number {
        return this.nextFloat() * (max - min) + min;
    }
}
