import { useMemo } from 'react';
import { useEntityBlockInstances } from '../src/entities/EntityInstancesBlock';
import { useSceneBlockData } from '../src/scene/SceneBlockDataContext';
import { createSceneQueryStacks } from './sceneQueryDataWitness';

export function SceneQueryDataLeaf({ index }: { index: number }) {
    const stacks = useMemo(() => createSceneQueryStacks(index), [index]);
    const data = useSceneBlockData();
    const instances = useEntityBlockInstances({ name: 'Bucket', stacks });
    return (
        <group
            name={`scene-query-leaf-${index}`}
            userData={{
                fixtureKind: 'scene-query-leaf',
                dataState:
                    data === undefined
                        ? 'undefined'
                        : data === null
                          ? 'null'
                          : 'data',
                instanceHeights: instances?.map(
                    (instance) => instance.stackHeight,
                ),
            }}
        >
            {instances?.map((instance) => (
                <mesh
                    key={instance.id}
                    name={`scene-query-bucket-${index}`}
                    position={instance.position}
                >
                    <boxGeometry args={[0.3, 0.3, 0.3]} />
                    <meshBasicMaterial
                        color={index % 2 === 0 ? '#ed6844' : '#428bd8'}
                    />
                </mesh>
            ))}
        </group>
    );
}
