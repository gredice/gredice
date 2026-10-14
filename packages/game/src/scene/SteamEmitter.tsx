import { useLayoutEffect, useRef } from 'react';
import type { Group } from 'three';
import { useSteamSources } from './SteamSources';

/** Attach only at an authored, unobstructed hot-surface anchor. */
export function SteamEmitter({
    id,
    position,
    radius,
    enabled = true,
}: {
    id: string;
    position: [number, number, number];
    radius: number;
    enabled?: boolean;
}) {
    const ref = useRef<Group>(null);
    const { register } = useSteamSources();
    useLayoutEffect(() => {
        if (enabled && ref.current)
            return register({ id, object: ref.current, radius });
    }, [enabled, id, radius, register]);
    return <group ref={ref} name={id} position={position} />;
}
