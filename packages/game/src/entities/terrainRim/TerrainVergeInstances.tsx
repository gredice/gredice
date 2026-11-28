import { useEffect, useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { useSceneBlockData } from '../../scene/SceneBlockDataContext';
import { snowPresets } from '../../snow/snowPresets';
import type { Stack } from '../../types/Stack';
import { useGameGLTF } from '../../utils/useGameGLTF';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
} from '../EntityInstancesBlock';
import { useGroundPatchMaterial } from '../helpers/groundPatchMaterial';
import {
    type TerrainRimWeatherProps,
    useTerrainDragPreview,
} from './TerrainRimInstances';
import { removeLiftedTerrainBlocks } from './terrainRimDragPlacements';
import {
    createTerrainVergeCornerGeometry,
    createTerrainVergeEdgeGeometry,
    createTerrainVergeInnerCornerGeometry,
    terrainVergeVariantCount,
} from './terrainVergeGeometry';
import {
    resolveTerrainVergePlacements,
    type TerrainVergePlacement,
} from './terrainVergePlacements';

type VergePlacement = TerrainVergePlacement<Stack>;

function toInstance(placement: VergePlacement): EntityBlockInstance {
    const { block, blockIndex, kind, stack, top, turn } = placement;
    return {
        block,
        blockIndex,
        id: `${stack.position.x}|${stack.position.z}|${block.id}|${blockIndex}|verge-${kind}-${turn}`,
        pickupOutlineVisible: false,
        position: [stack.position.x, top, stack.position.z],
        rotation: turn,
        stack,
        stackHeight: top,
    };
}

const taperCombinations = [
    { end: false, start: false },
    { end: false, start: true },
    { end: true, start: false },
    { end: true, start: true },
] as const;

function edgeKey(variant: number, taperStart: boolean, taperEnd: boolean) {
    return `${variant}:${taperStart ? 1 : 0}${taperEnd ? 1 : 0}`;
}

/** Edge shapes are built lazily, so unused taper combinations cost nothing. */
function useTerrainVergeGeometries() {
    const geometries = useMemo(
        () => ({
            corner: createTerrainVergeCornerGeometry(),
            inner: createTerrainVergeInnerCornerGeometry(),
            edges: new Map<string, BufferGeometry>(),
        }),
        [],
    );
    useEffect(
        () => () => {
            geometries.corner.dispose();
            geometries.inner.dispose();
            for (const geometry of geometries.edges.values()) {
                geometry.dispose();
            }
        },
        [geometries],
    );
    return geometries;
}

function LoadedTerrainVergeInstances({
    placements,
    ...weather
}: { placements: readonly VergePlacement[] } & TerrainRimWeatherProps) {
    const { nodes } = useGameGLTF('BlockGrass');
    // The lawn's own material, so the bank continues it.
    const material = useGroundPatchMaterial(
        nodes.Block_Grass_1_2.material,
        'grass',
    );
    const geometries = useTerrainVergeGeometries();
    const groups = useMemo(() => {
        const pieces: {
            geometry: BufferGeometry;
            instances: EntityBlockInstance[];
            key: string;
        }[] = [];
        for (let variant = 0; variant < terrainVergeVariantCount; variant++) {
            for (const taper of taperCombinations) {
                const instances = placements
                    .filter(
                        (placement) =>
                            placement.kind === 'edge' &&
                            placement.variant === variant &&
                            placement.taperStart === taper.start &&
                            placement.taperEnd === taper.end,
                    )
                    .map(toInstance);
                if (!instances.length) continue;
                const key = edgeKey(variant, taper.start, taper.end);
                let geometry = geometries.edges.get(key);
                if (!geometry) {
                    geometry = createTerrainVergeEdgeGeometry(variant, taper);
                    geometries.edges.set(key, geometry);
                }
                pieces.push({
                    geometry,
                    instances,
                    key: `TerrainVerge:edge:${key}`,
                });
            }
        }
        for (const kind of ['corner', 'inner'] as const) {
            pieces.push({
                geometry: geometries[kind],
                instances: placements
                    .filter((placement) => placement.kind === kind)
                    .map(toInstance),
                key: `TerrainVerge:${kind}`,
            });
        }
        return pieces.filter((piece) => piece.instances.length > 0);
    }, [geometries, placements]);

    if (Array.isArray(material)) return null;
    return groups.map((piece) => (
        <EntityInstancesGeometry
            // About 0.03 high: its shadow is a pixel or two, not worth a
            // second pass over every bank in the shadow map.
            castShadow={false}
            geometry={piece.geometry}
            instanceKey={piece.key}
            instances={piece.instances}
            key={piece.key}
            material={material}
            renderRainWetOverlay
            renderSnow={weather.renderSnow}
            snow={snowPresets.grassFlat}
            snowLift={0.01}
            snowOverlayMinCoverage={weather.snowOverlayMinCoverage}
            staticOpaqueCacheGroup="base-terrain"
            weatherSurface="base-ground"
        />
    ));
}

/**
 * A low, wandering grass bank wherever lawn meets a path, gravel, paving or
 * bare ground at the same height. It hides the straight tile edge between
 * the two. While a drag holds terrain blocks up, the bank follows the garden
 * without them, so none is left beside the hole they leave.
 */
export function TerrainVergeInstances({
    stacks,
    ...weather
}: { stacks: Stack[] | undefined } & TerrainRimWeatherProps) {
    const blockData = useSceneBlockData();
    const dragPreview = useTerrainDragPreview(stacks);
    const placements = useMemo(
        () =>
            resolveTerrainVergePlacements(
                blockData,
                removeLiftedTerrainBlocks(stacks, dragPreview),
            ),
        [blockData, dragPreview, stacks],
    );
    if (!placements.length) return null;
    return <LoadedTerrainVergeInstances placements={placements} {...weather} />;
}
