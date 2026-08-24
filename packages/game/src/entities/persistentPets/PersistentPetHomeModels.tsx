import { animated } from '@react-spring/three';
import { Mesh, type Object3D } from 'three';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useAnimatedEntityRotation } from '../helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from '../helpers/WeatheredEntityPart';
import {
    getPersistentPetHomePlacement,
    type PersistentPetHomeBlockName,
} from './persistentPetHomes';
import { getPersistentPetHomeSurfaceWeather } from './persistentPetHomeWeather';

function WeatheredPersistentPetHomeObject({ object }: { object: Object3D }) {
    const children = object.children.map((child) => (
        <WeatheredPersistentPetHomeObject key={child.uuid} object={child} />
    ));

    if (object instanceof Mesh) {
        const weather = getPersistentPetHomeSurfaceWeather(object.name);
        return (
            <WeatheredEntityPart
                material={object.material}
                node={object}
                rain={weather.rain}
                snow={weather.snow}
            >
                {children}
            </WeatheredEntityPart>
        );
    }

    return (
        <group
            name={object.name}
            position={object.position}
            rotation={object.rotation}
            scale={object.scale}
            visible={object.visible}
        >
            {children}
        </group>
    );
}

function PersistentPetHome({
    block,
    modelName,
    rotation,
    stack,
}: EntityInstanceProps & { modelName: PersistentPetHomeBlockName }) {
    const gltf = useGameGLTF(modelName);
    const currentStackHeight = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
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
            {gltf.scene.children.map((object) => (
                <WeatheredPersistentPetHomeObject
                    key={object.uuid}
                    object={object}
                />
            ))}
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
