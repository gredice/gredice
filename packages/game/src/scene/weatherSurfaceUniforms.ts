import { type IUniform, MathUtils } from 'three';

export type SnowSurfaceUniformOptions = {
    coverageMultiplier: number;
    overrideSnow: number | undefined;
};

export type RainSurfaceUniformOptions = {
    drySpeed: number;
    intensityMultiplier: number;
    wetSpeed: number;
};

export type WeatherSurfaceUniformStats = {
    rainConsumerCount: number;
    rainDistinctUniformCount: number;
    snowConsumerCount: number;
    snowDistinctUniformCount: number;
};

type SnowSurfaceUniformEntry = SnowSurfaceUniformOptions & {
    consumerCount: number;
    key: string;
    kind: 'snow';
    uniform: IUniform<number>;
};

type RainSurfaceUniformEntry = RainSurfaceUniformOptions & {
    consumerCount: number;
    key: string;
    kind: 'rain';
    uniform: IUniform<number>;
};

export type WeatherSurfaceUniformEntry =
    | SnowSurfaceUniformEntry
    | RainSurfaceUniformEntry;

type WeatherSurfaceValues = {
    rainAmount: number;
    snowCoverage: number;
};

const snowDampingSpeed = 6;

function clampUnit(value: number) {
    return Math.min(1, Math.max(0, value));
}

function snowEntryKey(options: SnowSurfaceUniformOptions) {
    const overrideKey =
        options.overrideSnow === undefined
            ? 'game'
            : String(options.overrideSnow);
    return `${options.coverageMultiplier}:${overrideKey}`;
}

function rainEntryKey(options: RainSurfaceUniformOptions) {
    return `${options.intensityMultiplier}:${options.drySpeed}:${options.wetSpeed}`;
}

export function resolveSnowSurfaceTarget(
    snowCoverage: number,
    options: SnowSurfaceUniformOptions,
) {
    return clampUnit(
        (options.overrideSnow ?? snowCoverage) * options.coverageMultiplier,
    );
}

export function resolveRainSurfaceTarget(
    rainAmount: number,
    options: Pick<RainSurfaceUniformOptions, 'intensityMultiplier'>,
) {
    return clampUnit(rainAmount * options.intensityMultiplier);
}

export function resolveRainPuddleStrength(rainAmount: number) {
    return Math.max(0, rainAmount - 0.66) / 0.34;
}

export class WeatherSurfaceUniformRegistry {
    readonly rainPuddleStrengthUniform: IUniform<number> = { value: 0 };

    private readonly rainEntries = new Map<string, RainSurfaceUniformEntry>();
    private readonly snowEntries = new Map<string, SnowSurfaceUniformEntry>();

    constructor(
        private readonly onStatsChange?: (
            stats: WeatherSurfaceUniformStats,
        ) => void,
    ) {}

    getSnowEntry(
        options: SnowSurfaceUniformOptions,
    ): WeatherSurfaceUniformEntry {
        const key = snowEntryKey(options);
        const existing = this.snowEntries.get(key);
        if (existing) {
            return existing;
        }

        const entry: SnowSurfaceUniformEntry = {
            ...options,
            consumerCount: 0,
            key,
            kind: 'snow',
            uniform: { value: 0 },
        };
        this.snowEntries.set(key, entry);
        return entry;
    }

    getRainEntry(
        options: RainSurfaceUniformOptions,
    ): WeatherSurfaceUniformEntry {
        const key = rainEntryKey(options);
        const existing = this.rainEntries.get(key);
        if (existing) {
            return existing;
        }

        const entry: RainSurfaceUniformEntry = {
            ...options,
            consumerCount: 0,
            key,
            kind: 'rain',
            uniform: { value: 0 },
        };
        this.rainEntries.set(key, entry);
        return entry;
    }

    retain(entry: WeatherSurfaceUniformEntry) {
        if (entry.consumerCount === 0) {
            entry.uniform.value = 0;
        }
        entry.consumerCount += 1;
        this.publishStats();

        let retained = true;
        return () => {
            if (!retained) {
                return;
            }

            retained = false;
            entry.consumerCount = Math.max(0, entry.consumerCount - 1);
            this.publishStats();
        };
    }

    advance(values: WeatherSurfaceValues, delta: number) {
        this.rainPuddleStrengthUniform.value = resolveRainPuddleStrength(
            values.rainAmount,
        );

        for (const entry of this.snowEntries.values()) {
            if (entry.consumerCount === 0) {
                continue;
            }

            entry.uniform.value = MathUtils.damp(
                entry.uniform.value,
                resolveSnowSurfaceTarget(values.snowCoverage, entry),
                snowDampingSpeed,
                delta,
            );
        }

        for (const entry of this.rainEntries.values()) {
            if (entry.consumerCount === 0) {
                continue;
            }

            const target = resolveRainSurfaceTarget(values.rainAmount, entry);
            const speed =
                target > entry.uniform.value ? entry.wetSpeed : entry.drySpeed;
            entry.uniform.value = MathUtils.damp(
                entry.uniform.value,
                target,
                speed,
                delta,
            );
        }
    }

    getStats(): WeatherSurfaceUniformStats {
        let rainConsumerCount = 0;
        let rainDistinctUniformCount = 0;
        let snowConsumerCount = 0;
        let snowDistinctUniformCount = 0;

        for (const entry of this.rainEntries.values()) {
            rainConsumerCount += entry.consumerCount;
            if (entry.consumerCount > 0) {
                rainDistinctUniformCount += 1;
            }
        }

        for (const entry of this.snowEntries.values()) {
            snowConsumerCount += entry.consumerCount;
            if (entry.consumerCount > 0) {
                snowDistinctUniformCount += 1;
            }
        }

        return {
            rainConsumerCount,
            rainDistinctUniformCount,
            snowConsumerCount,
            snowDistinctUniformCount,
        };
    }

    publishStats() {
        this.onStatsChange?.(this.getStats());
    }
}
