import { type ReactNode, useContext, useLayoutEffect, useRef } from 'react';
import type { Material, Mesh } from 'three';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { type SnowMaterialOptions, SnowOverlay } from '../../snow/SnowOverlay';
import { EntityPreviewContext } from './EntityPreviewContext';

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
    material?: Material | Material[];
    node: Mesh;
    rain?: RainOptions | false;
    receiveShadow?: boolean;
    snow?: SnowMaterialOptions | false;
}) {
    const preview = useContext(EntityPreviewContext);
    const mesh = useRef<Mesh>(null);
    // Preview groups keep cached GLTF resources; JSX-owned materials still need cleanup.
    const ownsPreviewMaterial = preview && !material && Boolean(children);
    useLayoutEffect(() => {
        if (!ownsPreviewMaterial || !mesh.current) return;
        const owned = mesh.current.material;
        return () => {
            for (const item of Array.isArray(owned) ? owned : [owned])
                item.dispose();
        };
    }, [ownsPreviewMaterial]);
    return (
        <mesh
            ref={mesh}
            customDepthMaterial={node.customDepthMaterial}
            customDistanceMaterial={node.customDistanceMaterial}
            castShadow={castShadow}
            geometry={node.geometry}
            material={material}
            name={node.name}
            position={node.position}
            receiveShadow={receiveShadow}
            rotation={node.rotation}
            scale={node.scale}
            visible={node.visible}
        >
            {children}
            {snow && !preview ? (
                <SnowOverlay geometry={node.geometry} {...snow} />
            ) : null}
            {rain && !preview ? (
                <RainWetOverlay geometry={node.geometry} {...rain} />
            ) : null}
        </mesh>
    );
}
