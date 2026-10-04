import { useContext, useLayoutEffect, useRef } from 'react';
import type { Group } from 'three';
import { EntityPreviewContext } from '../entities/helpers/EntityPreviewContext';
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
    const preview = useContext(EntityPreviewContext);
    const ref = useRef<Group>(null);
    const { register } = useSteamSources();
    useLayoutEffect(() => {
        if (enabled && !preview && ref.current)
            return register({ id, object: ref.current, radius });
    }, [enabled, preview, id, radius, register]);
    return <group ref={ref} name={id} position={position} />;
}
