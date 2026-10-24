import { useLayoutEffect } from 'react';
import { Ladybugs } from '../src/entities/ladybugs/Ladybugs';
import { LadybugLateResource } from './LadybugLateResource';
import type {
    createLadybugSuspenseGarden,
    createLadybugSuspenseGate,
    LadybugSuspenseLifecycle,
} from './ladybugSuspenseWitness';

export function LadybugSuspenseContent({
    garden,
    gate,
    lifecycle,
}: {
    garden: ReturnType<typeof createLadybugSuspenseGarden>;
    gate: ReturnType<typeof createLadybugSuspenseGate>;
    lifecycle: LadybugSuspenseLifecycle;
}) {
    useLayoutEffect(() => {
        lifecycle.mounts += 1;
        lifecycle.live = true;
        return () => {
            lifecycle.cleanups += 1;
            lifecycle.live = false;
        };
    }, [lifecycle]);
    return (
        <>
            <Ladybugs
                garden={garden}
                weather={{ temperature: 24, cloudy: 0, rainy: 0 }}
            />
            <LadybugLateResource gate={gate} />
        </>
    );
}
