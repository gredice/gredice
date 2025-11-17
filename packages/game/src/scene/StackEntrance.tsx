import {
    animated,
    config,
    useSpring,
    useSpringValue,
} from '@react-spring/three';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Material, Mesh, Vector3 } from 'three';
import {
    getStackEntranceDelay,
    getStackEntranceHeight,
    getStackRingDistance,
} from '../utils/stackEntranceAnimation';

function toMaterialArray(
    material: Material | Material[] | undefined,
): Material[] {
    if (!material) return [];
    return Array.isArray(material) ? material : [material];
}

type StackEntranceProps = PropsWithChildren<{
    position: Vector3;
    enabled?: boolean;
}>;

export function StackEntrance({
    position,
    enabled,
    children,
}: StackEntranceProps) {
    const groupRef = useRef<Group>(null);

    const ringDistance = useMemo(
        () => getStackRingDistance(position),
        [position.x, position.z],
    );
    const entranceDelay = useMemo(
        () => (enabled ? getStackEntranceDelay(position) : 0),
        [enabled, position.x, position.z],
    );
    const entranceHeight = useMemo(
        () => (enabled ? getStackEntranceHeight(ringDistance) : 0),
        [enabled, ringDistance],
    );

    const [{ yOffset, scale }] = useSpring(
        () => ({
            from: {
                yOffset: entranceHeight,
                scale: enabled ? 0.85 : 1,
            },
            to: {
                yOffset: 0,
                scale: 1,
            },
            delay: entranceDelay,
            config: {
                ...config.gentle,
                friction: 32,
            },
            immediate: !enabled,
        }),
        [entranceDelay, entranceHeight, enabled],
    );

    const opacity = useSpringValue(enabled ? 0 : 1, {
        config: { ...config.gentle, friction: 30 },
        delay: entranceDelay,
    });

    useEffect(() => {
        opacity.start({
            to: 1,
            delay: entranceDelay,
            immediate: !enabled,
        });
    }, [entranceDelay, enabled, opacity]);

    useEffect(() => {
        if (!groupRef.current) return undefined;

        const unsubscribe = opacity.onChange((value) => {
            groupRef.current?.traverse((child) => {
                const mesh = child as Mesh;
                const materials = toMaterialArray(
                    mesh.material as Material | Material[],
                );
                materials.forEach((material) => {
                    if (!material) return;
                    material.transparent = true;
                    material.opacity = value;
                });
            });
        });

        return () => unsubscribe?.();
    }, [opacity]);

    return (
        <animated.group ref={groupRef} position-y={yOffset} scale={scale}>
            {children}
        </animated.group>
    );
}
