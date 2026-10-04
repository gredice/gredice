import { useLayoutEffect, useRef } from 'react';
import { type Group, Mesh } from 'three';
import { EntityFactory } from '../entities/EntityFactory';
import { EntityPreviewContext } from '../entities/helpers/EntityPreviewContext';
import { SceneSpringAnimationContext } from '../scene/SceneSpringContext';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

/** Preview owns only material clones; cached geometry/materials and saved entities stay untouched. */
export function TranslucentPackLayoutItem({
    block,
    stack,
    onReady,
}: {
    block: Block;
    stack: Stack;
    onReady: (id: string, ready: boolean) => void;
}) {
    const group = useRef<Group>(null);
    useLayoutEffect(() => {
        const restorations: (() => void)[] = [];
        group.current?.traverse((object) => {
            if (!(object instanceof Mesh)) return;
            const original = object.material;
            const materials = (
                Array.isArray(original) ? original : [original]
            ).map((material) => {
                const clone = material.clone();
                clone.transparent = true;
                clone.opacity = 0.35;
                clone.depthWrite = false;
                return clone;
            });
            object.material = Array.isArray(original)
                ? materials
                : (materials[0] ?? original);
            const raycast = object.raycast;
            const castShadow = object.castShadow;
            object.castShadow = false;
            object.raycast = () => {};
            restorations.push(() => {
                object.material = original;
                object.raycast = raycast;
                object.castShadow = castShadow;
                for (const material of materials) material.dispose();
            });
        });
        onReady(block.id, restorations.length > 0);
        return () => {
            for (const restore of restorations) restore();
            onReady(block.id, false);
        };
    }, [block.id, onReady]);
    return (
        <group ref={group} name={`PackLayout:Ghost:${block.id}`} dispose={null}>
            <EntityPreviewContext.Provider value={true}>
                <SceneSpringAnimationContext.Provider value={false}>
                    <EntityFactory
                        name={block.name}
                        block={block}
                        stack={stack}
                        rotation={block.rotation}
                        noControl
                        weatherDisabled
                    />
                </SceneSpringAnimationContext.Provider>
            </EntityPreviewContext.Provider>
        </group>
    );
}
