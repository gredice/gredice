import { useMemo } from 'react';
import { useBreathSource } from '../src/scene/cold/BreathSources';
import { useGameGLTF } from '../src/utils/useGameGLTF';

export function ColdWeatherActor({ index }: { index: number }) {
    const species = index % 2 ? 'Goat' : 'Sheep';
    const gltf = useGameGLTF(species);
    const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
    useBreathSource(
        `${species}:${index}`,
        model.getObjectByName(`${species}_HeadPivot`) ?? null,
        true,
    );
    return (
        <group
            position={[(index % 5) - 2, 0.25, Math.floor(index / 5) * 1.5 - 1]}
            scale={0.46}
        >
            <primitive object={model} />
        </group>
    );
}
