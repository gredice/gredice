import type { ReactNode } from 'react';
import type { Material, Mesh } from 'three';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { type SnowMaterialOptions, SnowOverlay } from '../../snow/SnowOverlay';

type RainOptions = {
    darkness?: number;
    drySpeed?: number;
    glossiness?: number;
    intensityMultiplier?: number;
    minRain?: number;
    topSurfaceBias?: number;
    wetSpeed?: number;
};

export function WeatheredEntityPart({
    castShadow = true,
    children,
    material,
    node,
    rain = false,
    receiveShadow = true,
    snow = false,
}: {
    castShadow?: boolean;
    children?: ReactNode;
    material?: Material;
    node: Mesh;
    rain?: RainOptions | false;
    receiveShadow?: boolean;
    snow?: SnowMaterialOptions | false;
}) {
    return (
        <mesh
            castShadow={castShadow}
            geometry={node.geometry}
            material={material}
            name={node.name}
            position={node.position}
            receiveShadow={receiveShadow}
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
            {snow ? <SnowOverlay geometry={node.geometry} {...snow} /> : null}
            {rain ? (
                <RainWetOverlay geometry={node.geometry} {...rain} />
            ) : null}
        </mesh>
    );
}
