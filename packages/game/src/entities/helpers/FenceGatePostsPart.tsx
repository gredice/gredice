import { useRef } from 'react';
import type { Mesh } from 'three';
import type { GLTFResult } from '../../models/GameAssets';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { useRegisterAutumnPart } from '../../scene/AutumnParts';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { autumnPartLeafSurfaces } from './autumnLeafSurfaces';

type FenceGateNodeName = Extract<
    keyof GLTFResult['nodes'],
    `${'FenceGate' | 'WhiteFenceGate' | 'StoneFenceGate' | 'PolishedStoneFenceGate'}_${string}`
>;

export function FenceGatePostsPart({
    node,
    nodeName,
    blockId,
    covered,
    snowThickness,
}: {
    node: GLTFResult['nodes'][FenceGateNodeName];
    nodeName: FenceGateNodeName;
    blockId: string;
    covered: boolean;
    snowThickness: number;
}) {
    const ref = useRef<Mesh>(null);
    useRegisterAutumnPart({
        blockId,
        partId: nodeName,
        ref,
        surfaces: autumnPartLeafSurfaces[nodeName] ?? [],
        covered,
    });
    return (
        <mesh
            ref={ref}
            name={nodeName}
            castShadow
            receiveShadow
            geometry={node.geometry}
            material={node.material}
        >
            <SnowOverlay
                geometry={node.geometry}
                maxThickness={snowThickness}
                slopeExponent={2.9}
                noiseScale={3.3}
            />
            <RainWetOverlay geometry={node.geometry} />
        </mesh>
    );
}
