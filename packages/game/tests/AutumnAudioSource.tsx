import { useLayoutEffect, useState } from 'react';
import { Group } from 'three';
import { AutumnRustle } from '../src/audio/AutumnRustle';
import { useRegisterAutumnSources } from '../src/scene/AutumnSources';

export function AutumnAudioSource({
    enabled,
    hasTree,
    wind,
}: {
    enabled: boolean;
    hasTree: boolean;
    wind: number;
}) {
    const register = useRegisterAutumnSources();
    const [object] = useState(() => new Group());
    useLayoutEffect(
        () => (hasTree ? register({ id: 'audio-tree', object }) : undefined),
        [hasTree, object, register],
    );
    return <AutumnRustle windSpeed={wind} enabled={enabled} />;
}
