import type { createFaunaSimulation } from './faunaSimulation';

export type FaunaSimulationStats = ReturnType<
    ReturnType<typeof createFaunaSimulation>['getStats']
>;
export type FaunaSimulationProfileStats = FaunaSimulationStats & {
    rootCount: number;
};

/** Every active Canvas owns one snapshot; releasing it removes only its work. */
export function createFaunaSimulationProfile(
    publish: (stats: FaunaSimulationProfileStats | undefined) => void,
) {
    const snapshots = new Map<symbol, FaunaSimulationStats>();
    function publishAggregate() {
        if (snapshots.size === 0) {
            publish(undefined);
            return;
        }
        const aggregate: FaunaSimulationProfileStats = {
            rootCount: snapshots.size,
            simulationCallbacks: 0,
            renderCallbacks: 0,
            animationCallbacks: 0,
            stepCount: 0,
            renderCount: 0,
        };
        for (const snapshot of snapshots.values()) {
            aggregate.simulationCallbacks += snapshot.simulationCallbacks;
            aggregate.renderCallbacks += snapshot.renderCallbacks;
            aggregate.animationCallbacks += snapshot.animationCallbacks;
            aggregate.stepCount += snapshot.stepCount;
            aggregate.renderCount += snapshot.renderCount;
        }
        publish(aggregate);
    }
    return {
        register(initial: FaunaSimulationStats) {
            const owner = Symbol('fauna-simulation-profile-owner');
            snapshots.set(owner, { ...initial });
            publishAggregate();
            return {
                update(snapshot: FaunaSimulationStats) {
                    if (!snapshots.has(owner)) return;
                    snapshots.set(owner, { ...snapshot });
                    publishAggregate();
                },
                dispose() {
                    if (snapshots.delete(owner)) publishAggregate();
                },
            };
        },
    };
}
