import { useEffect, useMemo } from 'react';
import { type IUniform, Vector4 } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { usePrefersReducedMotion } from '../scene/IdleBreathingMotion';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../scene/SceneTime';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { getWaterBlockDepthSamples } from './waterBlockDepth';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
    resolveWaterRimExposure,
} from './waterBlockFoam';
import {
    createWaterBlockGeometry,
    defaultWaterBlockVisualHeight,
} from './waterBlockGeometry';
import {
    getWaterBlockCenterY,
    getWaterBlockVisualHeight,
} from './waterBlockHeight';
import {
    createWaterBlockMaterial,
    type WaterfallMaterialPart,
} from './waterBlockMaterial';
import { getWaterBlockStyle, type WaterBlockStyle } from './waterBlockNames';
import { isWaterBlockTopSurfaceVisible } from './waterBlockSurface';

const emptyWaterFoamCorners = new Vector4(0, 0, 0, 0);
/** Water holds still for viewers who ask for reduced motion. */
const stillWaterTimeUniform: IUniform<number> = { value: 0 };

type WaterBlockMaterialOptions = {
    style?: WaterBlockStyle;
    useFoamAttributes?: boolean;
    useLocalPositionAttribute?: boolean;
    useWaterDepthAttribute?: boolean;
    useShoreDepthAttribute?: boolean;
    waterDepth?: number;
    /** Local y of the top face, for meshes without surface attributes. */
    waterTopLocalY?: number;
    /** Waterfall part the material draws (garden water only). */
    waterfall?: WaterfallMaterialPart;
    /** Simpler waterfall shading for the low quality tier. */
    waterfallSimple?: boolean;
    /** Snow amount that fades landing foam on terrain. */
    waterfallSnowUniform?: IUniform<number>;
};

/** The lit water material of block water, kept in step with scene time. */
export function useWaterBlockMaterial(
    foamEdges: Vector4,
    discardInnerEdges = true,
    foamCorners: Vector4 = emptyWaterFoamCorners,
    options: WaterBlockMaterialOptions = {},
) {
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const sceneTimeUniform = useSceneTimeUniform();
    const reducedMotion = usePrefersReducedMotion();
    const timeUniform = reducedMotion
        ? stillWaterTimeUniform
        : sceneTimeUniform;
    useSceneTimeInvalidation(
        'water-surface-animation',
        fixedTimeSeconds === undefined && !reducedMotion,
    );
    const useFoamAttributes = options.useFoamAttributes === true;
    const useLocalPositionAttribute =
        options.useLocalPositionAttribute === true;
    const useWaterDepthAttribute = options.useWaterDepthAttribute === true;
    const useShoreDepthAttribute = options.useShoreDepthAttribute === true;
    const waterDepth = options.waterDepth ?? 0;
    const waterTopLocalY =
        options.waterTopLocalY ?? defaultWaterBlockVisualHeight / 2;
    const style = options.style ?? 'standard';
    const { waterfall, waterfallSimple, waterfallSnowUniform } = options;
    const material = useMemo(
        () =>
            createWaterBlockMaterial({
                discardInnerEdges,
                foamCorners,
                foamEdges,
                style,
                timeUniform,
                useFoamAttributes,
                useLocalPositionAttribute,
                useShoreDepthAttribute,
                useWaterDepthAttribute,
                waterDepth,
                waterTopLocalY,
                waterfall,
                waterfallSimple,
                waterfallSnowUniform,
            }),
        [
            discardInnerEdges,
            foamCorners,
            foamEdges,
            style,
            timeUniform,
            useFoamAttributes,
            useLocalPositionAttribute,
            useWaterDepthAttribute,
            useShoreDepthAttribute,
            waterDepth,
            waterTopLocalY,
            waterfall,
            waterfallSimple,
            waterfallSnowUniform,
        ],
    );

    useEffect(() => () => material.dispose(), [material]);

    return material;
}

export function BlockWater({ stack, block, stacks }: EntityInstanceProps) {
    const { data: blockData } = useBlockData();
    const waterHeight = getWaterBlockVisualHeight({
        block,
        blockData,
        stack,
    });
    const waterCenterY = getWaterBlockCenterY({
        block,
        blockData,
        stack,
    });
    const foamEdges = useMemo(
        () => resolveWaterFoamEdges({ block, blockData, stack, stacks }),
        [block, blockData, stack, stacks],
    );
    const foamCorners = useMemo(
        () => resolveWaterFoamCorners({ block, blockData, stack, stacks }),
        [block, blockData, stack, stacks],
    );
    const rim = useMemo(
        () => resolveWaterRimExposure({ block, blockData, stack, stacks }),
        [block, blockData, stack, stacks],
    );
    // The light bank edge belongs to a shore; an exposed side rounds over
    // instead, and its lip is lit, not painted.
    const bankEdges = useMemo(
        () =>
            new Vector4(
                rim.edges.x > 0.5 ? 0 : foamEdges.x,
                rim.edges.y > 0.5 ? 0 : foamEdges.y,
                rim.edges.z > 0.5 ? 0 : foamEdges.z,
                rim.edges.w > 0.5 ? 0 : foamEdges.w,
            ),
        [foamEdges, rim],
    );
    const bankCorners = useMemo(
        () =>
            new Vector4(
                rim.corners.x > 0.5 ? 0 : foamCorners.x,
                rim.corners.y > 0.5 ? 0 : foamCorners.y,
                rim.corners.z > 0.5 ? 0 : foamCorners.z,
                rim.corners.w > 0.5 ? 0 : foamCorners.w,
            ),
        [foamCorners, rim],
    );
    const includeTop = isWaterBlockTopSurfaceVisible({ block, stack });
    const waterDepth = Math.max(
        ...getWaterBlockDepthSamples({ block, blockData, stack }),
    );
    const geometry = useMemo(
        () =>
            createWaterBlockGeometry(foamEdges, {
                height: waterHeight,
                includeTop,
                rimCorners: rim.corners,
                rimEdges: rim.edges,
            }),
        [foamEdges, includeTop, rim, waterHeight],
    );
    // The geometry already leaves out walls between water blocks, so the
    // material need not discard them (it would also cut the rounded lips).
    const material = useWaterBlockMaterial(bankEdges, false, bankCorners, {
        style: getWaterBlockStyle(block.name) ?? 'standard',
        waterDepth,
        waterTopLocalY: waterHeight / 2,
    });

    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <animated.group position={stack.position.clone().setY(waterCenterY)}>
            <mesh
                receiveShadow
                geometry={geometry}
                material={material}
                renderOrder={1}
            />
        </animated.group>
    );
}
