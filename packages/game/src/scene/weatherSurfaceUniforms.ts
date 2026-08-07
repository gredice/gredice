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
    snowIntegrationReadyCount: number;
    snowIntegrationTrackedCount: number;
    snowIntegrationTransitionCount: number;
};

export type WeatherSurfaceUniformActivitySnapshot = {
    rainActive: boolean;
    rainDrying: boolean;
    rainSettling: boolean;
    snowActive: boolean;
    snowMelting: boolean;
    snowSettling: boolean;
};

export type SnowSurfaceUniformEntry = SnowSurfaceUniformOptions & {
    consumerCount: number;
    key: string;
    kind: 'snow';
    uniform: IUniform<number>;
};

export type RainSurfaceUniformEntry = RainSurfaceUniformOptions & {
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

type BooleanTransitionTracker<TEntry> = {
    active: boolean;
    entry: TEntry;
    listeners: Set<() => void>;
};

type SnowIntegrationTracker =
    BooleanTransitionTracker<SnowSurfaceUniformEntry> & {
        noiseInfluence: number;
    };

type RainActivityTracker = BooleanTransitionTracker<RainSurfaceUniformEntry> & {
    minimumWetness: number;
};

const snowDampingSpeed = 6;
const integratedSnowMinimumFragmentCoverage = 0.1;
const integratedSnowActivationSafetyMargin = 0.02;
const weatherSurfaceUniformVisualThreshold = 0.001;
const inactiveWeatherSurfaceUniformActivitySnapshot: WeatherSurfaceUniformActivitySnapshot =
    {
        rainActive: false,
        rainDrying: false,
        rainSettling: false,
        snowActive: false,
        snowMelting: false,
        snowSettling: false,
    };

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

/**
 * A single opaque pass cannot discard the prepared boundary skirt where
 * legacy sparse snow has holes without forfeiting early depth rejection for
 * the entire material. Keep sparse snow on the legacy overlay until even the
 * lowest-noise fragment is past its visibility threshold.
 */
export function canIntegrateSnowSurface(
    snowCoverage: number,
    options: SnowSurfaceUniformOptions & { noiseInfluence: number },
) {
    return resolveSnowSurfaceIntegrationReadiness({
        amount: resolveSnowSurfaceTarget(snowCoverage, options),
        noiseInfluence: options.noiseInfluence,
        wasReady: false,
    });
}

/**
 * Integration enters above the safe sparse-snow boundary and exits at that
 * boundary. The gap prevents a noisy weather target near the cutoff from
 * repeatedly rebuilding prepared geometry and materials, while the lower
 * threshold still guarantees that an integrated opaque pass never exposes
 * fragments that the legacy overlay would discard.
 */
export function resolveSnowSurfaceIntegrationReadiness({
    amount,
    noiseInfluence,
    wasReady,
}: {
    amount: number;
    noiseInfluence: number;
    wasReady: boolean;
}) {
    const minimumCoverage = clampUnit(amount) - Math.max(0, noiseInfluence);
    const threshold = wasReady
        ? integratedSnowMinimumFragmentCoverage
        : integratedSnowMinimumFragmentCoverage +
          integratedSnowActivationSafetyMargin;
    return minimumCoverage >= threshold;
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

    private readonly activityListeners = new Set<() => void>();
    private activitySnapshot = inactiveWeatherSurfaceUniformActivitySnapshot;
    private rainAmount = 0;
    private readonly rainActivityTrackers = new Map<
        string,
        RainActivityTracker
    >();
    private readonly rainEntries = new Map<string, RainSurfaceUniformEntry>();
    private readonly snowIntegrationTrackers = new Map<
        string,
        SnowIntegrationTracker
    >();
    private readonly snowEntries = new Map<string, SnowSurfaceUniformEntry>();
    private snowCoverage = 0;
    private snowIntegrationTransitionCount = 0;

    constructor(
        private readonly onStatsChange?: (
            stats: WeatherSurfaceUniformStats,
        ) => void,
    ) {}

    getSnowEntry(options: SnowSurfaceUniformOptions): SnowSurfaceUniformEntry {
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

    getRainEntry(options: RainSurfaceUniformOptions): RainSurfaceUniformEntry {
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
            this.refreshTransitionTrackers(entry);
        }
        entry.consumerCount += 1;
        this.refreshActivitySnapshot();
        this.publishStats();

        let retained = true;
        return () => {
            if (!retained) {
                return;
            }

            retained = false;
            entry.consumerCount = Math.max(0, entry.consumerCount - 1);
            this.refreshActivitySnapshot();
            this.publishStats();
        };
    }

    advance(values: WeatherSurfaceValues, delta: number) {
        this.rainAmount = values.rainAmount;
        this.snowCoverage = values.snowCoverage;
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
            this.refreshSnowIntegrationTrackers(entry);
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
            this.refreshRainActivityTrackers(entry);
        }

        this.refreshActivitySnapshot();
    }

    getActivitySnapshot = () => this.activitySnapshot;

    subscribeActivity = (listener: () => void) => {
        this.activityListeners.add(listener);
        return () => {
            this.activityListeners.delete(listener);
        };
    };

    getSnowIntegrationReady(
        entry: SnowSurfaceUniformEntry,
        noiseInfluence: number,
    ) {
        return this.getSnowIntegrationTracker(entry, noiseInfluence).active;
    }

    subscribeSnowIntegrationReadiness(
        entry: SnowSurfaceUniformEntry,
        noiseInfluence: number,
        listener: () => void,
    ) {
        const tracker = this.getSnowIntegrationTracker(entry, noiseInfluence);
        tracker.listeners.add(listener);
        this.publishStats();

        let subscribed = true;
        return () => {
            if (!subscribed) {
                return;
            }
            subscribed = false;
            tracker.listeners.delete(listener);
            if (tracker.listeners.size === 0) {
                this.snowIntegrationTrackers.delete(
                    this.snowIntegrationTrackerKey(entry, noiseInfluence),
                );
            }
            this.publishStats();
        };
    }

    getRainSurfaceActive(
        entry: RainSurfaceUniformEntry,
        minimumWetness: number,
    ) {
        return this.getRainActivityTracker(entry, minimumWetness).active;
    }

    subscribeRainSurfaceActivity(
        entry: RainSurfaceUniformEntry,
        minimumWetness: number,
        listener: () => void,
    ) {
        const tracker = this.getRainActivityTracker(entry, minimumWetness);
        tracker.listeners.add(listener);

        let subscribed = true;
        return () => {
            if (!subscribed) {
                return;
            }
            subscribed = false;
            tracker.listeners.delete(listener);
            if (tracker.listeners.size === 0) {
                this.rainActivityTrackers.delete(
                    this.rainActivityTrackerKey(entry, minimumWetness),
                );
            }
        };
    }

    getStats(): WeatherSurfaceUniformStats {
        let rainConsumerCount = 0;
        let rainDistinctUniformCount = 0;
        let snowConsumerCount = 0;
        let snowDistinctUniformCount = 0;
        let snowIntegrationReadyCount = 0;
        let snowIntegrationTrackedCount = 0;

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

        for (const tracker of this.snowIntegrationTrackers.values()) {
            if (tracker.listeners.size === 0) {
                continue;
            }
            snowIntegrationTrackedCount += 1;
            if (tracker.active) {
                snowIntegrationReadyCount += 1;
            }
        }

        return {
            rainConsumerCount,
            rainDistinctUniformCount,
            snowConsumerCount,
            snowDistinctUniformCount,
            snowIntegrationReadyCount,
            snowIntegrationTrackedCount,
            snowIntegrationTransitionCount: this.snowIntegrationTransitionCount,
        };
    }

    publishStats() {
        this.onStatsChange?.(this.getStats());
    }

    private snowIntegrationTrackerKey(
        entry: SnowSurfaceUniformEntry,
        noiseInfluence: number,
    ) {
        return `${entry.key}:${Math.max(0, noiseInfluence)}`;
    }

    private getSnowIntegrationTracker(
        entry: SnowSurfaceUniformEntry,
        noiseInfluence: number,
    ) {
        const normalizedNoiseInfluence = Math.max(0, noiseInfluence);
        const key = this.snowIntegrationTrackerKey(
            entry,
            normalizedNoiseInfluence,
        );
        const existing = this.snowIntegrationTrackers.get(key);
        if (existing) {
            return existing;
        }

        const tracker: SnowIntegrationTracker = {
            active: resolveSnowSurfaceIntegrationReadiness({
                amount: entry.uniform.value,
                noiseInfluence: normalizedNoiseInfluence,
                wasReady: false,
            }),
            entry,
            listeners: new Set(),
            noiseInfluence: normalizedNoiseInfluence,
        };
        this.snowIntegrationTrackers.set(key, tracker);
        return tracker;
    }

    private rainActivityTrackerKey(
        entry: RainSurfaceUniformEntry,
        minimumWetness: number,
    ) {
        return `${entry.key}:${Math.max(0, minimumWetness)}`;
    }

    private getRainActivityTracker(
        entry: RainSurfaceUniformEntry,
        minimumWetness: number,
    ) {
        const normalizedMinimumWetness = Math.max(0, minimumWetness);
        const key = this.rainActivityTrackerKey(
            entry,
            normalizedMinimumWetness,
        );
        const existing = this.rainActivityTrackers.get(key);
        if (existing) {
            return existing;
        }

        const tracker: RainActivityTracker = {
            active: entry.uniform.value >= normalizedMinimumWetness,
            entry,
            listeners: new Set(),
            minimumWetness: normalizedMinimumWetness,
        };
        this.rainActivityTrackers.set(key, tracker);
        return tracker;
    }

    private refreshTransitionTrackers(entry: WeatherSurfaceUniformEntry) {
        if (entry.kind === 'snow') {
            this.refreshSnowIntegrationTrackers(entry);
            return;
        }
        this.refreshRainActivityTrackers(entry);
    }

    private refreshSnowIntegrationTrackers(entry: SnowSurfaceUniformEntry) {
        let changed = false;
        for (const tracker of this.snowIntegrationTrackers.values()) {
            if (tracker.entry !== entry) {
                continue;
            }
            const active = resolveSnowSurfaceIntegrationReadiness({
                amount: entry.uniform.value,
                noiseInfluence: tracker.noiseInfluence,
                wasReady: tracker.active,
            });
            if (active === tracker.active) {
                continue;
            }
            tracker.active = active;
            this.snowIntegrationTransitionCount += 1;
            changed = true;
            for (const listener of tracker.listeners) {
                listener();
            }
        }
        if (changed) {
            this.publishStats();
        }
    }

    private refreshRainActivityTrackers(entry: RainSurfaceUniformEntry) {
        for (const tracker of this.rainActivityTrackers.values()) {
            if (tracker.entry !== entry) {
                continue;
            }
            const active = entry.uniform.value >= tracker.minimumWetness;
            if (active === tracker.active) {
                continue;
            }
            tracker.active = active;
            for (const listener of tracker.listeners) {
                listener();
            }
        }
    }

    private refreshActivitySnapshot() {
        let rainActive = false;
        let rainDrying = false;
        let rainSettling = false;
        let snowActive = false;
        let snowMelting = false;
        let snowSettling = false;

        for (const entry of this.rainEntries.values()) {
            if (entry.consumerCount === 0) {
                continue;
            }

            const target = resolveRainSurfaceTarget(this.rainAmount, entry);
            const active =
                entry.uniform.value > weatherSurfaceUniformVisualThreshold;
            rainActive ||= active;
            rainDrying ||=
                active && target <= weatherSurfaceUniformVisualThreshold;
            rainSettling ||=
                Math.abs(entry.uniform.value - target) >
                weatherSurfaceUniformVisualThreshold;
        }

        for (const entry of this.snowEntries.values()) {
            if (entry.consumerCount === 0) {
                continue;
            }

            const target = resolveSnowSurfaceTarget(this.snowCoverage, entry);
            const active =
                entry.uniform.value > weatherSurfaceUniformVisualThreshold;
            snowActive ||= active;
            snowMelting ||=
                active && target <= weatherSurfaceUniformVisualThreshold;
            snowSettling ||=
                Math.abs(entry.uniform.value - target) >
                weatherSurfaceUniformVisualThreshold;
        }

        const previous = this.activitySnapshot;
        if (
            previous.rainActive === rainActive &&
            previous.rainDrying === rainDrying &&
            previous.rainSettling === rainSettling &&
            previous.snowActive === snowActive &&
            previous.snowMelting === snowMelting &&
            previous.snowSettling === snowSettling
        ) {
            return;
        }

        this.activitySnapshot = {
            rainActive,
            rainDrying,
            rainSettling,
            snowActive,
            snowMelting,
            snowSettling,
        };
        for (const listener of this.activityListeners) {
            listener();
        }
    }
}
