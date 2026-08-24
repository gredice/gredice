import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import type { Mesh } from 'three';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useAnimatedEntityRotation } from '../helpers/useAnimatedEntityRotation';
import {
    getPersistentPetHomePlacement,
    type PersistentPetHomeBlockName,
} from './persistentPetHomes';

function PersistentPetHome({
    block,
    modelName,
    rotation,
    stack,
}: EntityInstanceProps & { modelName: PersistentPetHomeBlockName }) {
    const gltf = useGameGLTF(modelName);
    const currentStackHeight = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        scene.traverse((object) => {
            if ('isMesh' in object && object.isMesh) {
                const mesh = object as Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return scene;
    }, [gltf.scene]);
    const placement = getPersistentPetHomePlacement({
        blockName: modelName,
        rotation,
        x: stack.position.x,
        z: stack.position.z,
    });

    return (
        <animated.group
            position={[
                placement.center.x,
                currentStackHeight,
                placement.center.z,
            ]}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <primitive object={model} />
        </animated.group>
    );
}

export function RabbitHutch(props: EntityInstanceProps) {
    return <PersistentPetHome {...props} modelName="RabbitHutch" />;
}

export function HorseStable(props: EntityInstanceProps) {
    return <PersistentPetHome {...props} modelName="HorseStable" />;
}

export function CowShelter(props: EntityInstanceProps) {
    return <PersistentPetHome {...props} modelName="CowShelter" />;
}

export function GoatShelter(props: EntityInstanceProps) {
    return <PersistentPetHome {...props} modelName="GoatShelter" />;
}

export function SheepFold(props: EntityInstanceProps) {
    return <PersistentPetHome {...props} modelName="SheepFold" />;
}
