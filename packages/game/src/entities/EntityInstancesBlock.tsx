import {
    cloneElement,
    isValidElement,
    memo,
    type ReactNode,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import type { BufferGeometry, InstancedMesh, Material } from 'three';
import {
    type ActiveDragPreviewTarget,
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
    getActiveDragPreviewTargetPositionOffset,
} from '../dragPreviewIdentity';
import { useGameFlags } from '../GameFlagsContext';
import { useBlockData } from '../hooks/useBlockData';
import {
    RainWetOverlay,
    useRainWetOverlayMaterial,
    useRainWetOverlayVisible,
} from '../rain/RainWetOverlay';
import { registerCloudShadowAttenuationMaterialCandidate } from '../scene/cloudShadowAttenuation';
import {
    StaticOpaqueSceneCacheBoundary,
    type StaticOpaqueSceneCacheGroup,
} from '../scene/StaticOpaqueSceneCache';
import {
    useRainSurfacePuddleStrengthUniform,
    useRainSurfaceWetnessActive,
    useRainSurfaceWetnessUniform,
    useSnowSurfaceIntegrationState,
} from '../scene/WeatherSurfaceUniformProvider';
import {
    countGeometryTriangles,
    createWeatherSurfaceGeometry,
    getWeatherSurfaceGeometryMetadata,
} from '../scene/weatherSurfaceGeometry';
import {
    createIntegratedWeatherSurfaceMaterial,
    getWeatherSurfacePluginVariantKey,
    resolveWeatherSurfacePluginMode,
    supportsIntegratedWeatherSurfaceMaterial,
} from '../scene/weatherSurfaceMaterial';
import {
    registerWeatherSurfaceRenderEntry,
    type WeatherSurfaceMode,
} from '../scene/weatherSurfaceRenderRegistry';
import { createSnowOverlayGeometry } from '../snow/createSnowOverlayGeometry';
import {
    type SnowMaterialOptions,
    SnowOverlay,
    useSnowMaterial,
    useSnowOverlayVisible,
} from '../snow/SnowOverlay';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { type ActiveDragPreview, useGameState } from '../useGameState';
import { getStackHeight } from '../utils/getStackHeight';
import {
    createMergedChunkGeometry,
    createMeshInstanceMatrix,
    type MeshInstanceChunk,
    type MeshInstanceLocalTransform,
} from './chunkedMeshGeometry';
import {
    getIndexedEntityBlocks,
    useEntityBlockInstanceIndex,
} from './entityBlockInstanceIndex';
import { blockPickupOutlineStyle } from './helpers/blockPickupOutlineStyle';
import { HoverOutline } from './helpers/HoverOutline';
import { QueuedPlacementDropAnimation } from './helpers/PlacementDropAnimation';
import {
    addressPlacementAnimationChunks,
    createPlacementAnimationChunkCache,
    createPlacementDropAnimationRenderIdsSelector,
    localizePlacementDropAnimationChunks,
} from './placementAnimationChunks';
import {
    placementAnimationProfileNow,
    recordPlacementAnimationChunkRebuild,
    recordPlacementAnimationChunkUpdate,
    shouldRecordPlacementAnimationChunkRebuild,
} from './placementAnimationProfileMetrics';

const defaultLocalPosition: [number, number, number] = [0, 0, 0];
const defaultLocalRotation: [number, number, number] = [0, 0, 0];
const fallbackWeatherSurfaceBounds = {
    max: [0.5, 0.5, 0.5] as const,
    min: [-0.5, -0.5, -0.5] as const,
};

export type EntityInstancesBlockBaseProps = {
    stacks: Stack[] | undefined;
    name: string;
    renderSnow?: boolean;
    localPosition?: [number, number, number];
    localRotation?: [number, number, number];
    yOffset?: number;
    snowLift?: number;
    snowOverlayMinCoverage?: number;
    scale?: number | [number, number, number];
    geometry: BufferGeometry;
    snow?: SnowMaterialOptions;
    renderRainWetOverlay?: boolean;
    renderStableChunksAsMergedGeometry?: boolean;
    staticOpaqueCacheGroup?: StaticOpaqueSceneCacheGroup;
    weatherSurface?: 'base-ground';
    castShadow?: boolean;
    receiveShadow?: boolean;
    renderOrder?: number;
};

export type EntityInstancesBlockMaterialProps =
    | {
          material: Material | Material[];
          materialNode?: never;
      }
    | {
          material?: never;
          materialNode: ReactNode;
      };

export type EntityBlockInstance = {
    block: Block;
    blockIndex: number;
    id: string;
    pickupOutlineVisible: boolean;
    position: [number, number, number];
    rotation: number;
    stack: Stack;
    stackHeight: number;
};

function numbersEqual(left: number, right: number) {
    return Math.abs(left - right) <= 0.0001;
}

function tuplesEqual(
    left: [number, number, number],
    right: [number, number, number],
) {
    return (
        numbersEqual(left[0], right[0]) &&
        numbersEqual(left[1], right[1]) &&
        numbersEqual(left[2], right[2])
    );
}

function scalesEqual(
    left: EntityInstancesBlockBaseProps['scale'],
    right: EntityInstancesBlockBaseProps['scale'],
) {
    if (left === right) {
        return true;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
        return tuplesEqual(left, right);
    }
    return false;
}

function entityBlockInstancesEqual(
    left: EntityBlockInstance[] | undefined,
    right: EntityBlockInstance[] | undefined,
) {
    if (left === right) {
        return true;
    }
    if (!left || !right || left.length !== right.length) {
        return false;
    }

    return left.every((leftInstance, index) => {
        const rightInstance = right[index];
        return (
            Boolean(rightInstance) &&
            leftInstance.block === rightInstance.block &&
            leftInstance.blockIndex === rightInstance.blockIndex &&
            leftInstance.id === rightInstance.id &&
            leftInstance.pickupOutlineVisible ===
                rightInstance.pickupOutlineVisible &&
            tuplesEqual(leftInstance.position, rightInstance.position) &&
            numbersEqual(leftInstance.rotation, rightInstance.rotation) &&
            leftInstance.stack === rightInstance.stack &&
            numbersEqual(leftInstance.stackHeight, rightInstance.stackHeight)
        );
    });
}

function useStableEntityBlockInstances(
    instances: EntityBlockInstance[] | undefined,
) {
    const previous = useRef<EntityBlockInstance[] | undefined>(undefined);

    if (!entityBlockInstancesEqual(previous.current, instances)) {
        previous.current = instances;
    }

    return previous.current;
}

function useStableTuple(tuple: [number, number, number]) {
    const previous = useRef(tuple);

    if (!tuplesEqual(previous.current, tuple)) {
        previous.current = tuple;
    }

    return previous.current;
}

function useStableScale(scale: EntityInstancesBlockBaseProps['scale']) {
    const previous = useRef(scale);

    if (!scalesEqual(previous.current, scale)) {
        previous.current = scale;
    }

    return previous.current;
}

function cloneMaterialNode(materialNode: ReactNode) {
    return isValidElement(materialNode)
        ? cloneElement(materialNode)
        : materialNode;
}

function blockNameMatches(
    blockName: string,
    name: string | undefined,
    names: readonly string[] | undefined,
) {
    return blockName === name || (names?.includes(blockName) ?? false);
}

function activeDragTargetKey(target: ActiveDragPreviewTarget) {
    return `${target.stackPosition.x}|${target.stackPosition.z}|${target.blockId}|${target.blockIndex}`;
}

function activeDragTargetTouchesBlockNames(
    target: ActiveDragPreviewTarget | null | undefined,
    blockNameByActiveDragTargetKey: ReadonlyMap<string, string>,
    name: string | undefined,
    names: readonly string[] | undefined,
) {
    if (!target) {
        return false;
    }

    const blockName = blockNameByActiveDragTargetKey.get(
        activeDragTargetKey(target),
    );

    return blockName ? blockNameMatches(blockName, name, names) : false;
}

function activeDragPreviewTouchesBlockNames(
    preview: ActiveDragPreview | null,
    blockNameByActiveDragTargetKey: ReadonlyMap<string, string>,
    name: string | undefined,
    names: readonly string[] | undefined,
) {
    if (!preview) {
        return false;
    }

    return (
        activeDragTargetTouchesBlockNames(
            preview.source,
            blockNameByActiveDragTargetKey,
            name,
            names,
        ) ||
        preview.targets.some((target) =>
            activeDragTargetTouchesBlockNames(
                target,
                blockNameByActiveDragTargetKey,
                name,
                names,
            ),
        )
    );
}

export function useEntityBlockInstances({
    name,
    names,
    stacks,
    yOffset,
}: {
    name?: string;
    names?: readonly string[];
    stacks: Stack[] | undefined;
    yOffset?: number;
}) {
    const { data: blockData } = useBlockData();
    const entityBlockInstanceIndex = useEntityBlockInstanceIndex(stacks);
    const { blockNameByActiveDragTargetKey } = entityBlockInstanceIndex;
    const activeDragPreview = useGameState((state) =>
        activeDragPreviewTouchesBlockNames(
            state.activeDragPreview,
            blockNameByActiveDragTargetKey,
            name,
            names,
        )
            ? state.activeDragPreview
            : null,
    );
    const stationaryPickupOutlineTarget = useGameState((state) =>
        activeDragTargetTouchesBlockNames(
            state.stationaryPickupOutlineTarget,
            blockNameByActiveDragTargetKey,
            name,
            names,
        )
            ? state.stationaryPickupOutlineTarget
            : null,
    );

    const indexedBlocks = getIndexedEntityBlocks(
        entityBlockInstanceIndex,
        name,
        names,
    );
    const instances = stacks
        ? indexedBlocks.map(
              ({ block, blockIndex, stack }): EntityBlockInstance => {
                  const stackHeight = getStackHeight(blockData, stack, block);
                  const target = createActiveDragPreviewTarget({
                      blockId: block.id,
                      blockIndex,
                      stackPosition: stack.position,
                  });
                  const dragPreviewOffset =
                      getActiveDragPreviewTargetPositionOffset(
                          target,
                          activeDragPreview,
                      );
                  const stationaryPickupOutlineVisible =
                      activeDragPreviewTargetMatches(
                          stationaryPickupOutlineTarget,
                          target,
                      );

                  return {
                      block,
                      blockIndex,
                      id: `${stack.position.x}|${stack.position.z}|${block.id}|${blockIndex}`,
                      pickupOutlineVisible:
                          Boolean(dragPreviewOffset) ||
                          stationaryPickupOutlineVisible,
                      position: [
                          stack.position.x + (dragPreviewOffset?.x ?? 0),
                          stackHeight +
                              (yOffset ?? 0) +
                              (dragPreviewOffset?.y ?? 0),
                          stack.position.z + (dragPreviewOffset?.z ?? 0),
                      ],
                      rotation: block.rotation || 0,
                      stack,
                      stackHeight,
                  };
              },
          )
        : undefined;

    return useStableEntityBlockInstances(instances);
}

export function EntityInstancesBlock(
    props: EntityInstancesBlockBaseProps & EntityInstancesBlockMaterialProps,
) {
    const {
        stacks,
        name,
        renderSnow = true,
        localPosition,
        localRotation,
        yOffset,
        snowLift = 0,
        snowOverlayMinCoverage,
        scale,
        geometry,
        snow,
        renderRainWetOverlay = false,
        renderStableChunksAsMergedGeometry,
        staticOpaqueCacheGroup,
        weatherSurface,
        castShadow = true,
        receiveShadow = true,
        renderOrder,
    } = props;
    const blockInstances = useEntityBlockInstances({
        name,
        stacks,
        yOffset,
    });

    const commonProps = {
        castShadow,
        geometry,
        instanceKey: name,
        instances: blockInstances,
        localPosition,
        localRotation,
        receiveShadow,
        renderOrder,
        renderRainWetOverlay,
        renderStableChunksAsMergedGeometry,
        renderSnow,
        scale,
        snow,
        snowLift,
        snowOverlayMinCoverage,
        staticOpaqueCacheGroup,
        weatherSurface,
    };

    if ('material' in props && props.material !== undefined) {
        return (
            <EntityInstancesGeometry
                {...commonProps}
                material={props.material}
            />
        );
    }

    return (
        <EntityInstancesGeometry
            {...commonProps}
            materialNode={props.materialNode}
        />
    );
}

type EntityInstancesGeometryProps = Omit<
    EntityInstancesBlockBaseProps,
    'name' | 'stacks' | 'yOffset'
> &
    EntityInstancesBlockMaterialProps & {
        instanceKey: string;
        instances: EntityBlockInstance[] | undefined;
    };

type IntegratedStableWeather = {
    geometry: BufferGeometry;
    integratesRain: boolean;
    integratesSnow: boolean;
    material: Material;
    pluginVariantKey: string;
};

export function EntityInstancesGeometry(props: EntityInstancesGeometryProps) {
    const flags = useGameFlags();
    const weatherSurfaceMode: WeatherSurfaceMode =
        flags.enableIntegratedWeatherSurfacesFlag === false
            ? 'legacy'
            : 'integrated';
    const material = 'material' in props ? props.material : undefined;
    const integrationEligible =
        weatherSurfaceMode === 'integrated' &&
        props.weatherSurface === 'base-ground' &&
        props.snow !== undefined &&
        !Array.isArray(material) &&
        material !== undefined &&
        supportsIntegratedWeatherSurfaceMaterial(material);

    if (integrationEligible) {
        return (
            <IntegratedWeatherEntityInstancesGeometry
                {...props}
                sourceMaterial={material}
                weatherSurfaceMode={weatherSurfaceMode}
            />
        );
    }

    return (
        <EntityInstancesGeometryRenderer
            {...props}
            weatherSurfaceMode={weatherSurfaceMode}
        />
    );
}

function IntegratedWeatherEntityInstancesGeometry({
    sourceMaterial,
    ...props
}: {
    sourceMaterial: Parameters<
        typeof createIntegratedWeatherSurfaceMaterial
    >[0];
    weatherSurfaceMode: WeatherSurfaceMode;
} & EntityInstancesGeometryProps) {
    const {
        geometry,
        renderRainWetOverlay = false,
        renderSnow = true,
        snow,
        snowLift = 0,
        snowOverlayMinCoverage,
    } = props;
    const wetnessUniform = useRainSurfaceWetnessUniform({
        drySpeed: 1.8,
        intensityMultiplier: 1,
        wetSpeed: 5,
    });
    const puddleStrengthUniform = useRainSurfacePuddleStrengthUniform();
    const rainOverlayVisible = useRainWetOverlayVisible();
    const rainSurfaceActive =
        renderRainWetOverlay && Boolean(rainOverlayVisible);
    const snowOverlayVisible = useSnowOverlayVisible({
        coverageMultiplier: snow?.coverageMultiplier,
        minCoverage: snowOverlayMinCoverage,
        overrideSnow: snow?.overrideSnow,
    });
    const snowSurfaceActive = Boolean(snow && renderSnow && snowOverlayVisible);
    const snowNoiseInfluence = snow?.noiseInfluence ?? 0.15;
    const { amountUniform: snowAmountUniform, ready: snowIntegrationReady } =
        useSnowSurfaceIntegrationState({
            coverageMultiplier: snow?.coverageMultiplier ?? 1,
            noiseInfluence: snowNoiseInfluence,
            overrideSnow: snow?.overrideSnow,
        });
    const integratesSnow = snowSurfaceActive && snowIntegrationReady;
    const integratesRain = rainSurfaceActive;
    const hasIntegratedWeather = integratesRain || integratesSnow;
    const pluginVariantKey = hasIntegratedWeather
        ? getWeatherSurfacePluginVariantKey(
              resolveWeatherSurfacePluginMode({
                  rainEnabled: integratesRain,
                  snowEnabled: integratesSnow,
              }),
          )
        : undefined;
    const rainBounds = useMemo(() => {
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        const bounds = geometry.boundingBox;
        if (!bounds) {
            return fallbackWeatherSurfaceBounds;
        }
        return {
            max: [bounds.max.x, bounds.max.y, bounds.max.z] as const,
            min: [bounds.min.x, bounds.min.y, bounds.min.z] as const,
        };
    }, [geometry]);
    const preparedGeometry = useMemo(
        () =>
            integratesSnow
                ? createWeatherSurfaceGeometry(geometry, {
                      includeSnowSkirts: true,
                  })
                : geometry,
        [geometry, integratesSnow],
    );
    const integratedMaterial = useMemo(() => {
        if (!hasIntegratedWeather) {
            return undefined;
        }
        return createIntegratedWeatherSurfaceMaterial(sourceMaterial, {
            rain: {
                bounds: rainBounds,
                darkness: 1,
                enabled: rainSurfaceActive,
                glossiness: 0.7,
                puddleStrengthUniform,
                topSurfaceBias: 1.8,
                wetnessUniform,
            },
            snow: {
                amountUniform: snowAmountUniform,
                color: snow?.color ?? '#f7f7ff',
                enabled: integratesSnow,
                lift: snowLift || 0.003,
                maxThickness: snow?.maxThickness ?? 0.18,
                noiseAmplitude: snow?.noiseAmplitude ?? 0.35,
                noiseInfluence: snowNoiseInfluence,
                noiseScale: snow?.noiseScale ?? 2.5,
                slopeExponent: snow?.slopeExponent ?? 2.4,
            },
        });
    }, [
        hasIntegratedWeather,
        puddleStrengthUniform,
        rainBounds,
        rainSurfaceActive,
        integratesSnow,
        snow,
        snowAmountUniform,
        snowLift,
        snowNoiseInfluence,
        sourceMaterial,
        wetnessUniform,
    ]);
    const integratedStableWeather = useMemo(
        () =>
            integratedMaterial && pluginVariantKey
                ? {
                      geometry: preparedGeometry,
                      integratesRain,
                      integratesSnow,
                      material: integratedMaterial,
                      pluginVariantKey,
                  }
                : undefined,
        [
            integratedMaterial,
            integratesRain,
            integratesSnow,
            pluginVariantKey,
            preparedGeometry,
        ],
    );

    useLayoutEffect(() => {
        if (!integratedMaterial) {
            return;
        }
        return registerCloudShadowAttenuationMaterialCandidate(
            integratedMaterial,
        );
    }, [integratedMaterial]);
    useEffect(() => {
        if (!integratedMaterial) {
            return;
        }
        return () => integratedMaterial.dispose();
    }, [integratedMaterial]);

    return (
        <EntityInstancesGeometryRenderer
            {...props}
            integratedStableWeather={integratedStableWeather}
        />
    );
}

function EntityInstancesGeometryRenderer(
    props: EntityInstancesGeometryProps & {
        integratedStableWeather?: IntegratedStableWeather;
        weatherSurfaceMode: WeatherSurfaceMode;
    },
) {
    const {
        instanceKey,
        instances: incomingInstances,
        renderSnow = true,
        localPosition,
        localRotation,
        scale,
        geometry,
        snow,
        snowLift = 0,
        snowOverlayMinCoverage,
        renderRainWetOverlay = false,
        renderStableChunksAsMergedGeometry = false,
        staticOpaqueCacheGroup,
        integratedStableWeather,
        weatherSurfaceMode,
        castShadow = true,
        receiveShadow = true,
        renderOrder,
    } = props;
    const instances = useStableEntityBlockInstances(incomingInstances);
    const stableLocalPosition = useStableTuple(
        localPosition ?? defaultLocalPosition,
    );
    const stableLocalRotation = useStableTuple(
        localRotation ?? defaultLocalRotation,
    );
    const stableScale = useStableScale(scale);
    const localTransform = useMemo(
        () => ({
            position: stableLocalPosition,
            rotation: stableLocalRotation,
        }),
        [stableLocalPosition, stableLocalRotation],
    );
    const addressedChunks = useMemo(
        () => addressPlacementAnimationChunks(instances ?? []),
        [instances],
    );
    const selectAnimatedRenderIds = useMemo(
        () =>
            createPlacementDropAnimationRenderIdsSelector([
                ...addressedChunks.addressByBlockId.keys(),
            ]),
        [addressedChunks.addressByBlockId],
    );
    const animatedRenderIds = useGameState(selectAnimatedRenderIds);
    const placementAnimationChunkCache = useMemo(
        () => createPlacementAnimationChunkCache<EntityBlockInstance>(),
        [],
    );
    const localizedChunks = useMemo(
        () =>
            localizePlacementDropAnimationChunks(
                addressedChunks,
                animatedRenderIds,
                placementAnimationChunkCache,
            ),
        [addressedChunks, animatedRenderIds, placementAnimationChunkCache],
    );
    const {
        animatedInstances,
        chunks: stableChunks,
        placementSignatureByChunkKey,
    } = localizedChunks;
    const previousPlacementProjection = useRef<
        | {
              addressedChunks: typeof addressedChunks;
              placementSignatureByChunkKey: ReadonlyMap<string, string>;
          }
        | undefined
    >(undefined);

    useEffect(() => {
        const previousProjection = previousPlacementProjection.current;
        previousPlacementProjection.current = {
            addressedChunks,
            placementSignatureByChunkKey,
        };
        if (
            !previousProjection ||
            previousProjection.addressedChunks !== addressedChunks
        ) {
            return;
        }

        const candidateChunkKeys = new Set([
            ...previousProjection.placementSignatureByChunkKey.keys(),
            ...placementSignatureByChunkKey.keys(),
        ]);
        let touchedChunkCount = 0;
        for (const chunkKey of candidateChunkKeys) {
            if (
                previousProjection.placementSignatureByChunkKey.get(
                    chunkKey,
                ) !== placementSignatureByChunkKey.get(chunkKey)
            ) {
                touchedChunkCount += 1;
            }
        }
        if (touchedChunkCount > 0) {
            recordPlacementAnimationChunkUpdate({ touchedChunkCount });
        }
    }, [addressedChunks, placementSignatureByChunkKey]);

    const material = 'material' in props ? props.material : undefined;
    const materialNode =
        'materialNode' in props ? props.materialNode : undefined;
    const stableGeometry = integratedStableWeather?.geometry ?? geometry;
    const stableMaterial = integratedStableWeather?.material ?? material;
    const integratesStableRain =
        integratedStableWeather?.integratesRain === true;
    const integratesStableSnow =
        integratedStableWeather?.integratesSnow === true;
    const stableMaterialNode = integratedStableWeather
        ? undefined
        : materialNode;
    const staticOpaqueCacheContentKey = useMemo(
        () => ({
            castShadow,
            localTransform,
            placementSignatureByChunkKey,
            receiveShadow,
            renderOrder,
            renderStableChunksAsMergedGeometry,
            stableChunks,
            stableGeometry,
            stableMaterial,
            stableMaterialNode,
            stableScale,
        }),
        [
            castShadow,
            localTransform,
            placementSignatureByChunkKey,
            receiveShadow,
            renderOrder,
            renderStableChunksAsMergedGeometry,
            stableChunks,
            stableGeometry,
            stableMaterial,
            stableMaterialNode,
            stableScale,
        ],
    );
    const weatherRegistryId = useId();
    const rainOverlayVisible = useRainWetOverlayVisible();
    const rainOverlayEnabled = renderRainWetOverlay;
    const rainWetnessActive = useRainSurfaceWetnessActive({
        drySpeed: 1.8,
        enabled: rainOverlayEnabled,
        intensityMultiplier: 1,
        minimumWetness: 0.01,
        wetSpeed: 5,
    });
    const snowOverlayVisible = useSnowOverlayVisible({
        coverageMultiplier: snow?.coverageMultiplier,
        minCoverage: snowOverlayMinCoverage,
        overrideSnow: snow?.overrideSnow,
    });
    const sourceTriangleCount = useMemo(
        () => countGeometryTriangles(geometry),
        [geometry],
    );
    const activeRainOverlay = rainOverlayEnabled && rainOverlayVisible;
    const activeAnimatedRainOverlay =
        rainOverlayEnabled && (rainOverlayVisible || rainWetnessActive);
    const activeSnowOverlay = Boolean(snow) && renderSnow && snowOverlayVisible;
    const snowOverlayTriangleCount = useMemo(() => {
        if (!activeSnowOverlay) {
            return 0;
        }
        if (integratesStableSnow && integratedStableWeather) {
            const metadata = getWeatherSurfaceGeometryMetadata(
                integratedStableWeather.geometry,
            );
            if (!metadata?.includesSnowSkirts) {
                throw new Error(
                    'Integrated snow surface is missing its prepared boundary skirts.',
                );
            }
            return metadata.preparedTriangleCount;
        }
        return countGeometryTriangles(createSnowOverlayGeometry(geometry));
    }, [
        activeSnowOverlay,
        geometry,
        integratedStableWeather,
        integratesStableSnow,
    ]);
    const stableInstanceCount = useMemo(
        () =>
            stableChunks.reduce(
                (total, chunk) => total + chunk.instances.length,
                0,
            ),
        [stableChunks],
    );
    const stableTriangleCount = useMemo(
        () => stableInstanceCount * countGeometryTriangles(stableGeometry),
        [stableGeometry, stableInstanceCount],
    );
    const stableRainOverlaySubmissionCount = activeRainOverlay
        ? stableChunks.length
        : 0;
    const stableSnowOverlaySubmissionCount = activeSnowOverlay
        ? stableChunks.length
        : 0;
    const stableRainOverlayTriangleCount = activeRainOverlay
        ? stableInstanceCount * sourceTriangleCount
        : 0;
    const stableSnowOverlayTriangleCount = activeSnowOverlay
        ? stableInstanceCount * snowOverlayTriangleCount
        : 0;
    const animatedOverlaySubmissionCount =
        (activeAnimatedRainOverlay ? animatedInstances.length : 0) +
        (activeSnowOverlay ? animatedInstances.length : 0);
    const animatedOverlayTriangleCount =
        (activeAnimatedRainOverlay
            ? animatedInstances.length * sourceTriangleCount
            : 0) +
        (activeSnowOverlay
            ? animatedInstances.length * snowOverlayTriangleCount
            : 0);
    const hasWeatherSurface =
        renderRainWetOverlay || Boolean(snow && renderSnow);

    useEffect(() => {
        if (!hasWeatherSurface) {
            return;
        }

        const integrated = integratedStableWeather !== undefined;
        const avoidedOverlaySubmissionCount =
            (integratesStableRain ? stableRainOverlaySubmissionCount : 0) +
            (integratesStableSnow ? stableSnowOverlaySubmissionCount : 0);
        const avoidedOverlayTriangleCount =
            (integratesStableRain ? stableRainOverlayTriangleCount : 0) +
            (integratesStableSnow ? stableSnowOverlayTriangleCount : 0);
        const fallbackStableOverlaySubmissionCount =
            (integratesStableRain ? 0 : stableRainOverlaySubmissionCount) +
            (integratesStableSnow ? 0 : stableSnowOverlaySubmissionCount);
        const fallbackStableOverlayTriangleCount =
            (integratesStableRain ? 0 : stableRainOverlayTriangleCount) +
            (integratesStableSnow ? 0 : stableSnowOverlayTriangleCount);
        return registerWeatherSurfaceRenderEntry(
            `${weatherRegistryId}:${instanceKey}`,
            {
                avoidedOverlaySubmissionCount,
                avoidedOverlayTriangleCount,
                fallbackOverlaySubmissionCount:
                    animatedOverlaySubmissionCount +
                    fallbackStableOverlaySubmissionCount,
                fallbackOverlayTriangleCount:
                    animatedOverlayTriangleCount +
                    fallbackStableOverlayTriangleCount,
                integratedInstanceCount: integrated ? stableInstanceCount : 0,
                integratedMaterialCount: integrated ? 1 : 0,
                mode: weatherSurfaceMode,
                pluginVariantKeys: integrated
                    ? [integratedStableWeather.pluginVariantKey]
                    : [],
            },
        );
    }, [
        animatedOverlaySubmissionCount,
        animatedOverlayTriangleCount,
        hasWeatherSurface,
        instanceKey,
        integratedStableWeather,
        integratesStableRain,
        integratesStableSnow,
        stableInstanceCount,
        stableRainOverlaySubmissionCount,
        stableRainOverlayTriangleCount,
        stableSnowOverlaySubmissionCount,
        stableSnowOverlayTriangleCount,
        weatherRegistryId,
        weatherSurfaceMode,
    ]);

    if (!instances?.length) {
        return null;
    }

    const renderAnimatedInstances = (suffix: string) =>
        animatedInstances.map(({ instance: data, renderId }) => (
            <QueuedPlacementDropAnimation
                key={`block-${instanceKey}-${suffix}-placement:${renderId}`}
                animationRenderId={renderId}
                block={data.block}
                particlePosition={[
                    data.position[0],
                    data.stackHeight,
                    data.position[2],
                ]}
                position={data.position}
            >
                <group rotation={[0, data.rotation * (Math.PI / 2), 0]}>
                    <mesh
                        geometry={geometry}
                        material={material}
                        position={localTransform.position}
                        rotation={localTransform.rotation}
                        scale={stableScale}
                        receiveShadow={receiveShadow}
                        castShadow={false}
                        renderOrder={renderOrder}
                    >
                        {cloneMaterialNode(materialNode)}
                    </mesh>
                </group>
            </QueuedPlacementDropAnimation>
        ));

    const renderAnimatedSnowOverlays = () =>
        !snow || !renderSnow
            ? null
            : animatedInstances.map(({ instance: data, renderId }) => (
                  <QueuedPlacementDropAnimation
                      key={`block-${instanceKey}-snow-placement:${renderId}`}
                      animationRenderId={renderId}
                      block={data.block}
                      particlePosition={[
                          data.position[0],
                          data.stackHeight,
                          data.position[2],
                      ]}
                      position={[
                          data.position[0],
                          data.position[1] + (snowLift || 0.003),
                          data.position[2],
                      ]}
                  >
                      <group rotation={[0, data.rotation * (Math.PI / 2), 0]}>
                          <group
                              position={localTransform.position}
                              rotation={localTransform.rotation}
                              scale={stableScale}
                          >
                              <SnowOverlay
                                  geometry={geometry}
                                  minCoverage={snowOverlayMinCoverage}
                                  {...snow}
                              />
                          </group>
                      </group>
                  </QueuedPlacementDropAnimation>
              ));

    const renderAnimatedRainOverlays = () =>
        !renderRainWetOverlay
            ? null
            : animatedInstances.map(({ instance: data, renderId }) => (
                  <QueuedPlacementDropAnimation
                      key={`block-${instanceKey}-rain-placement:${renderId}`}
                      animationRenderId={renderId}
                      block={data.block}
                      particlePosition={[
                          data.position[0],
                          data.stackHeight,
                          data.position[2],
                      ]}
                      position={data.position}
                  >
                      <group rotation={[0, data.rotation * (Math.PI / 2), 0]}>
                          <group
                              position={localTransform.position}
                              rotation={localTransform.rotation}
                              scale={stableScale}
                          >
                              <RainWetOverlay geometry={geometry} />
                          </group>
                      </group>
                  </QueuedPlacementDropAnimation>
              ));

    return (
        <>
            <StaticOpaqueSceneCacheBoundary
                contentKey={staticOpaqueCacheContentKey}
                group={staticOpaqueCacheGroup}
                instanceCount={stableInstanceCount}
                submissionCount={stableChunks.length}
                triangleCount={stableTriangleCount}
            >
                {stableChunks.map((chunk) => {
                    const placementSignature =
                        placementSignatureByChunkKey.get(chunk.key) ?? '';

                    return renderStableChunksAsMergedGeometry ? (
                        <ChunkedMergedMesh
                            key={`${instanceKey}:${chunk.key}`}
                            castShadow={castShadow}
                            chunk={chunk}
                            debugName={`MergedBlockChunk:${instanceKey}:chunk:${chunk.key}:count:${chunk.instances.length}`}
                            geometry={stableGeometry}
                            localTransform={localTransform}
                            material={stableMaterial}
                            materialNode={stableMaterialNode}
                            placementSignature={placementSignature}
                            receiveShadow={receiveShadow}
                            renderOrder={renderOrder}
                            scale={stableScale}
                        />
                    ) : (
                        <ChunkedInstancedMesh
                            key={`${instanceKey}:${chunk.key}`}
                            castShadow={castShadow}
                            chunk={chunk}
                            debugName={`BlockInstances:${instanceKey}:chunk:${chunk.key}:count:${chunk.instances.length}`}
                            geometry={stableGeometry}
                            localTransform={localTransform}
                            material={stableMaterial}
                            materialNode={stableMaterialNode}
                            placementSignature={placementSignature}
                            receiveShadow={receiveShadow}
                            renderOrder={renderOrder}
                            scale={stableScale}
                        />
                    );
                })}
            </StaticOpaqueSceneCacheBoundary>
            {renderAnimatedInstances('base')}
            {(instances ?? []).map((data) =>
                data.pickupOutlineVisible ? (
                    <HoverOutline
                        key={`block-${instanceKey}-pickup-outline-${data.id}`}
                        {...blockPickupOutlineStyle}
                        hovered
                    >
                        <group
                            position={data.position}
                            rotation={[0, data.rotation * (Math.PI / 2), 0]}
                        >
                            <mesh
                                geometry={geometry}
                                position={localTransform.position}
                                rotation={localTransform.rotation}
                                scale={stableScale}
                                raycast={() => null}
                            >
                                <meshBasicMaterial visible={false} />
                            </mesh>
                        </group>
                    </HoverOutline>
                ) : null,
            )}
            {!integratesStableRain && renderRainWetOverlay && (
                <InstancedRainWetOverlays
                    chunks={stableChunks}
                    geometry={geometry}
                    localTransform={localTransform}
                    placementSignatureByChunkKey={placementSignatureByChunkKey}
                    scale={stableScale}
                />
            )}
            {!integratesStableSnow && snow && renderSnow && (
                <InstancedSnowOverlays
                    chunks={stableChunks}
                    geometry={geometry}
                    localTransform={localTransform}
                    placementSignatureByChunkKey={placementSignatureByChunkKey}
                    scale={stableScale}
                    snow={snow}
                    snowLift={snowLift}
                    snowOverlayMinCoverage={snowOverlayMinCoverage}
                />
            )}
            {renderAnimatedRainOverlays()}
            {renderAnimatedSnowOverlays()}
        </>
    );
}

const ChunkedInstancedMesh = memo(function ChunkedInstancedMesh({
    castShadow,
    chunk,
    debugName,
    geometry,
    localTransform,
    material,
    materialNode,
    placementSignature,
    receiveShadow,
    renderOrder,
    scale,
}: {
    castShadow: boolean;
    chunk: MeshInstanceChunk<EntityBlockInstance>;
    debugName: string;
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    material: Material | Material[] | undefined;
    materialNode: ReactNode;
    placementSignature: string;
    receiveShadow: boolean;
    renderOrder?: number;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const meshRef = useRef<InstancedMesh | null>(null);
    const previousChunkInstances = useRef<EntityBlockInstance[] | undefined>(
        undefined,
    );
    const previousPlacementSignature = useRef<string | undefined>(undefined);

    useLayoutEffect(() => {
        const startedAt = placementAnimationProfileNow();
        const mesh = meshRef.current;
        if (mesh) {
            chunk.instances.forEach((instance, index) => {
                mesh.setMatrixAt(
                    index,
                    createMeshInstanceMatrix(instance, localTransform, scale),
                );
            });
            mesh.count = chunk.instances.length;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingBox();
            mesh.computeBoundingSphere();
        }

        const previousInstances = previousChunkInstances.current;
        const previousSignature = previousPlacementSignature.current;
        previousChunkInstances.current = chunk.instances;
        previousPlacementSignature.current = placementSignature;
        if (
            shouldRecordPlacementAnimationChunkRebuild({
                currentInstances: chunk.instances,
                currentPlacementSignature: placementSignature,
                previousInstances,
                previousPlacementSignature: previousSignature,
            })
        ) {
            recordPlacementAnimationChunkRebuild({
                durationMs: placementAnimationProfileNow() - startedAt,
                transformedInstanceCount: chunk.instances.length,
            });
        }
    }, [chunk.instances, localTransform, placementSignature, scale]);

    if (chunk.instances.length === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={meshRef}
            name={debugName}
            args={[geometry, material, chunk.instances.length]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            renderOrder={renderOrder}
        >
            {cloneMaterialNode(materialNode)}
        </instancedMesh>
    );
});

const ChunkedMergedMesh = memo(function ChunkedMergedMesh({
    castShadow,
    chunk,
    debugName,
    geometry,
    localTransform,
    material,
    materialNode,
    placementSignature,
    receiveShadow,
    renderOrder,
    scale,
}: {
    castShadow: boolean;
    chunk: MeshInstanceChunk<EntityBlockInstance>;
    debugName: string;
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    material: Material | Material[] | undefined;
    materialNode: ReactNode;
    placementSignature: string;
    receiveShadow: boolean;
    renderOrder?: number;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const previousChunkInstances = useRef<EntityBlockInstance[] | undefined>(
        undefined,
    );
    const previousPlacementSignature = useRef<string | undefined>(undefined);
    const mergedGeometryBuild = useMemo(() => {
        const startedAt = placementAnimationProfileNow();
        const mergedGeometry = createMergedChunkGeometry({
            geometry,
            instances: chunk.instances,
            localTransform,
            scale,
        });

        return {
            durationMs: placementAnimationProfileNow() - startedAt,
            geometry: mergedGeometry,
        };
    }, [chunk.instances, geometry, localTransform, scale]);
    const mergedGeometry = mergedGeometryBuild.geometry;

    useEffect(() => () => mergedGeometry.dispose(), [mergedGeometry]);
    useEffect(() => {
        const previousInstances = previousChunkInstances.current;
        const previousSignature = previousPlacementSignature.current;
        previousChunkInstances.current = chunk.instances;
        previousPlacementSignature.current = placementSignature;
        if (
            !shouldRecordPlacementAnimationChunkRebuild({
                currentInstances: chunk.instances,
                currentPlacementSignature: placementSignature,
                previousInstances,
                previousPlacementSignature: previousSignature,
            })
        ) {
            return;
        }

        recordPlacementAnimationChunkRebuild({
            durationMs: mergedGeometryBuild.durationMs,
            transformedInstanceCount: chunk.instances.length,
        });
    }, [
        chunk.instances,
        chunk.instances.length,
        mergedGeometryBuild.durationMs,
        placementSignature,
    ]);

    if (!mergedGeometry.getAttribute('position')) {
        return null;
    }

    return (
        <mesh
            name={debugName}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            renderOrder={renderOrder}
            geometry={mergedGeometry}
            material={material}
        >
            {cloneMaterialNode(materialNode)}
        </mesh>
    );
});

function InstancedSnowOverlays({
    chunks,
    geometry,
    localTransform,
    placementSignatureByChunkKey,
    scale,
    snow,
    snowLift,
    snowOverlayMinCoverage,
}: {
    chunks: MeshInstanceChunk<EntityBlockInstance>[];
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    placementSignatureByChunkKey: ReadonlyMap<string, string>;
    scale: EntityInstancesBlockBaseProps['scale'];
    snow: SnowMaterialOptions;
    snowLift: number;
    snowOverlayMinCoverage?: number;
}) {
    const visible = useSnowOverlayVisible({
        coverageMultiplier: snow.coverageMultiplier,
        minCoverage: snowOverlayMinCoverage,
        overrideSnow: snow.overrideSnow,
    });
    const overlayGeometry = useMemo(
        () => createSnowOverlayGeometry(geometry),
        [geometry],
    );
    const bounds = useMemo(() => {
        if (!overlayGeometry.boundingBox) {
            overlayGeometry.computeBoundingBox();
        }
        const box = overlayGeometry.boundingBox;
        if (!box) {
            return snow.bounds;
        }
        return {
            min: [box.min.x, box.min.y, box.min.z] as [number, number, number],
            max: [box.max.x, box.max.y, box.max.z] as [number, number, number],
        };
    }, [overlayGeometry, snow.bounds]);
    const material = useSnowMaterial({
        ...snow,
        bounds: snow.bounds ?? bounds,
    });
    const liftedTransform = useMemo(
        () => ({
            ...localTransform,
            position: [
                localTransform.position[0],
                localTransform.position[1] + (snowLift || 0.003),
                localTransform.position[2],
            ] as [number, number, number],
        }),
        [localTransform, snowLift],
    );

    if (!visible) {
        return null;
    }

    return chunks.map((chunk) => (
        <ChunkedInstancedMesh
            key={`snow:${chunk.key}`}
            castShadow={false}
            chunk={chunk}
            debugName={`SnowOverlay:${chunk.key}:count:${chunk.instances.length}`}
            geometry={overlayGeometry}
            localTransform={liftedTransform}
            material={material}
            materialNode={null}
            placementSignature={
                placementSignatureByChunkKey.get(chunk.key) ?? ''
            }
            receiveShadow={false}
            scale={scale}
        />
    ));
}

function InstancedRainWetOverlays({
    chunks,
    geometry,
    localTransform,
    placementSignatureByChunkKey,
    scale,
}: {
    chunks: MeshInstanceChunk<EntityBlockInstance>[];
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    placementSignatureByChunkKey: ReadonlyMap<string, string>;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const visible = useRainWetOverlayVisible();

    if (!visible) {
        return null;
    }

    return (
        <VisibleInstancedRainWetOverlays
            chunks={chunks}
            geometry={geometry}
            localTransform={localTransform}
            placementSignatureByChunkKey={placementSignatureByChunkKey}
            scale={scale}
        />
    );
}

function VisibleInstancedRainWetOverlays({
    chunks,
    geometry,
    localTransform,
    placementSignatureByChunkKey,
    scale,
}: {
    chunks: MeshInstanceChunk<EntityBlockInstance>[];
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    placementSignatureByChunkKey: ReadonlyMap<string, string>;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const material = useRainWetOverlayMaterial({ geometry });

    return chunks.map((chunk) => (
        <ChunkedInstancedMesh
            key={`rain:${chunk.key}`}
            castShadow={false}
            chunk={chunk}
            debugName={`RainWetOverlay:${chunk.key}:count:${chunk.instances.length}`}
            geometry={geometry}
            localTransform={localTransform}
            material={material}
            materialNode={null}
            placementSignature={
                placementSignatureByChunkKey.get(chunk.key) ?? ''
            }
            receiveShadow={false}
            scale={scale}
        />
    ));
}
