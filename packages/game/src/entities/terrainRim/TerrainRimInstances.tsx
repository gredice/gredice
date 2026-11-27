import { Suspense, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
    Color,
    type Material,
    MeshStandardMaterial,
    RepeatWrapping,
    SRGBColorSpace,
    type Texture,
    TextureLoader,
    Vector3,
} from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import { useSceneBlockData } from '../../scene/SceneBlockDataContext';
import {
    type SnowMaterialOptions,
    useSnowOverlayVisible,
} from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { dryGroundBaseColor } from '../dryGroundPalette';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
} from '../EntityInstancesBlock';
import { blockPickupOutlineStyle } from '../helpers/blockPickupOutlineStyle';
import {
    createGroundPatchMaterial,
    groundSurfaceColors,
} from '../helpers/groundPatchMaterial';
import { HoverOutline } from '../helpers/HoverOutline';
import {
    createTerrainDragTargetKeys,
    dragPreviewLiftsTerrain,
    resolveLiftedTerrainRimPlacements,
    resolveTerrainRimDragPlacements,
    type TerrainRimOffset,
} from './terrainRimDragPlacements';
import {
    createTerrainRimGeometryCache,
    type TerrainRimGeometryCache,
    type TerrainRimGeometrySet,
    terrainRimGeometryKey,
} from './terrainRimPieceGeometry';
import {
    isTerrainRimBlockName,
    type TerrainRimBody,
    type TerrainRimPlacement,
    type TerrainRimSurface,
    terrainRimBodyForSurface,
    terrainRimSurfaceOf,
} from './terrainRimPlacements';
import {
    createSharedTerrainRimResources,
    useSharedTerrainRimResource,
} from './terrainRimSharedResources';

/** Soil under the grass lip. Dark enough to read as a separate layer. */
const terrainRimSoilColor = '#8b5630';
/**
 * Painted soil layers, generated for this look (assets/game-textures). The
 * texture is painted in the colour players see, so the tint brings it down
 * to the same albedo as the flat soil colour.
 */
const terrainRimSoilTexturePath = '/assets/textures/terrain-soil.webp';
const terrainRimSoilTextureTint = new Color().setRGB(0.536, 0.638, 0.714);

function createSoilMaterial(texture: Texture | null) {
    return new MeshStandardMaterial({
        color: texture ? terrainRimSoilTextureTint : terrainRimSoilColor,
        map: texture,
        roughness: 0.8,
        metalness: 0,
    });
}

/**
 * The soil of one texture url: flat soil at first, then a material with the
 * painted texture once it has loaded. Its users swap to the textured one
 * when it arrives, as a new material, so cached terrain redraws with it.
 */
function createTerrainRimSoil(url: string) {
    const flat = createSoilMaterial(null);
    let textured: MeshStandardMaterial | null = null;
    let texture: Texture | null = null;
    let state: 'idle' | 'loading' | 'disposed' = 'idle';
    const listeners = new Set<() => void>();
    return {
        material: (): MeshStandardMaterial => textured ?? flat,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        load: () => {
            if (state !== 'idle') return;
            state = 'loading';
            new TextureLoader()
                .loadAsync(url)
                .then((value) => {
                    if (state === 'disposed') {
                        value.dispose();
                        return;
                    }
                    value.colorSpace = SRGBColorSpace;
                    value.wrapS = RepeatWrapping;
                    value.wrapT = RepeatWrapping;
                    value.anisotropy = 4;
                    texture = value;
                    textured = createSoilMaterial(value);
                    for (const listener of listeners) listener();
                })
                .catch(() => {
                    // The flat soil colour stays; the texture is decoration.
                    console.warn(`Terrain soil texture failed to load: ${url}`);
                });
        },
        dispose: () => {
            state = 'disposed';
            listeners.clear();
            flat.dispose();
            textured?.dispose();
            texture?.dispose();
        },
    };
}

type TerrainRimSoil = ReturnType<typeof createTerrainRimSoil>;

const terrainRimSoils = createSharedTerrainRimResources<TerrainRimSoil>(
    (soil) => soil.dispose(),
);

/**
 * The garden rim's soil, shared with the HUD preview: a preview mounts with
 * the soil the garden already loaded and loads no texture of its own.
 */
function useTerrainRimSoilMaterial() {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const url = `${appBaseUrl ?? ''}${terrainRimSoilTexturePath}`;
    const soil = useSharedTerrainRimResource(terrainRimSoils, {
        key: url,
        create: () => createTerrainRimSoil(url),
    });
    useEffect(() => soil.load(), [soil]);
    return useSyncExternalStore(soil.subscribe, soil.material, soil.material);
}

/** A rim piece; a piece of a lifted block also carries its drag offset. */
type RimPlacement = TerrainRimPlacement<Stack> & { offset?: TerrainRimOffset };

function toInstance(placement: RimPlacement): EntityBlockInstance {
    const { block, blockIndex, kind, offset, shape, stack, top, turn } =
        placement;
    const height = top + (offset?.y ?? 0);
    // Shaped pieces of one side differ by geometry (a stair's two halves).
    const piece = shape ? `${kind}-${placement.geometryKey}` : kind;
    return {
        block,
        blockIndex,
        id: `${stack.position.x}|${stack.position.z}|${block.id}|${blockIndex}|rim-${piece}-${turn}`,
        pickupOutlineVisible: false,
        position: [
            stack.position.x + (offset?.x ?? 0),
            height,
            stack.position.z + (offset?.z ?? 0),
        ],
        rotation: turn,
        stack,
        stackHeight: height,
    };
}

const terrainRimGeometryCaches =
    createSharedTerrainRimResources<TerrainRimGeometryCache>((cache) =>
        cache.dispose(),
    );

const terrainRimGeometriesRequest = {
    key: 'terrain-rim',
    create: createTerrainRimGeometryCache,
};

/**
 * Rim geometry, built on first use and shared by the garden rim and the
 * HUD preview. Under snow the lips need no snow skirts (see
 * `sealTerrainRimWeatherSkirts`); the sealed `snowLip` copies add only
 * degenerate triangles, so they are drawn only while snow lies.
 */
function useTerrainRimGeometries() {
    return useSharedTerrainRimResource(
        terrainRimGeometryCaches,
        terrainRimGeometriesRequest,
    );
}

/** Code-owned ground and patched lip materials, shared like the soil. */
const terrainRimMaterials = createSharedTerrainRimResources<Material>(
    (material) => material.dispose(),
);

type RimGeometries = TerrainRimGeometryCache;

/** Placements grouped by the geometry they draw in `set`. */
function groupByGeometry(
    set: TerrainRimGeometrySet,
    placements: readonly RimPlacement[],
) {
    const groups = new Map<string, RimPlacement[]>();
    for (const placement of placements) {
        const key = terrainRimGeometryKey(set, placement);
        const group = groups.get(key);
        if (group) group.push(placement);
        else groups.set(key, [placement]);
    }
    return [...groups.entries()];
}

/** Snow and rain settings shared with the terrain blocks the lip continues. */
export type TerrainRimWeatherProps = {
    /** Wet lips in rain, as the block tops they continue (default on). */
    renderRainWet?: boolean;
    renderSnow?: boolean;
    snowOverlayMinCoverage?: number;
};

/** Each lip takes the snow preset of the block type it belongs to. */
const lipSnowBySurface = {
    dirt: { maxThickness: 0.22, slopeExponent: 3.2, noiseScale: 1.7 },
    dryDirt: snowPresets.sand,
    grass: snowPresets.grassFlat,
    gravel: snowPresets.stone,
    polishedStone: snowPresets.stone,
    sand: snowPresets.sand,
    snow: snowPresets.snow,
    stone: snowPresets.stone,
    swampDirt: snowPresets.sand,
} satisfies Record<TerrainRimSurface, SnowMaterialOptions>;

/**
 * Each lip lifts its snow as far as the block top it continues does, so the
 * cover runs over the rim without a step or a seam line.
 */
const lipSnowLiftBySurface = {
    dirt: 0.003,
    dryDirt: 0.003,
    grass: 0.01,
    gravel: 0.002,
    polishedStone: 0.002,
    sand: 0.003,
    snow: 0.003,
    stone: 0.002,
    swampDirt: 0.003,
} satisfies Record<TerrainRimSurface, number>;

function TerrainRimPieces({
    geometries,
    geometryKey,
    instanceKey,
    lifted,
    material,
    placements,
    set,
    weather,
}: {
    geometries: RimGeometries;
    /** The geometry every placement here draws in `set`. */
    geometryKey: string;
    instanceKey: string;
    /**
     * Pieces of blocks a drag holds up. They move with the pointer, so they
     * stay out of the static terrain cache and its merged packets and draw
     * as plain instances of the same geometry and material.
     */
    lifted?: boolean;
    material: Material;
    placements: readonly RimPlacement[];
    set: TerrainRimGeometrySet;
    /** Set for lips, so they get wet and snowed on like the block top. */
    weather?: TerrainRimWeatherProps & {
        snow: SnowMaterialOptions;
        snowLift: number;
    };
}) {
    const instances = useMemo(() => placements.map(toInstance), [placements]);
    const [first] = placements;
    if (!instances.length || !first) return null;
    return (
        <EntityInstancesGeometry
            geometry={geometries.get(set, first)}
            instanceKey={`${instanceKey}:${geometryKey}${lifted ? ':lifted' : ''}`}
            instances={instances}
            material={material}
            staticOpaqueCacheGroup={lifted ? undefined : 'base-terrain'}
            {...(weather
                ? {
                      renderRainWetOverlay: weather.renderRainWet ?? true,
                      renderSnow: weather.renderSnow,
                      snow: weather.snow,
                      snowLift: weather.snowLift,
                      snowOverlayMinCoverage: weather.snowOverlayMinCoverage,
                      weatherSurface: 'base-ground' as const,
                  }
                : {})}
        />
    );
}

type TerrainRimPieceSets = {
    /** Pieces lifted by a drag, drawn live beside the static terrain. */
    liftedPlacements: readonly RimPlacement[];
    /** Wraps the lifted pieces in the block pickup outline. */
    outlineLifted?: boolean;
    /** Pieces resting in the garden. */
    placements: readonly RimPlacement[];
};

/**
 * Every piece kind of one material, resting and lifted. Both sets share the
 * material and geometry, so lifting a block creates neither.
 */
function TerrainRimPieceKinds({
    liftedPlacements,
    outlineLifted,
    placements,
    ...pieceProps
}: TerrainRimPieceSets &
    Omit<
        Parameters<typeof TerrainRimPieces>[0],
        'geometryKey' | 'lifted' | 'placements'
    >) {
    const { set } = pieceProps;
    const resting = useMemo(
        () => groupByGeometry(set, placements),
        [placements, set],
    );
    const liftedGroups = useMemo(
        () => groupByGeometry(set, liftedPlacements),
        [liftedPlacements, set],
    );
    const lifted =
        liftedGroups.length > 0
            ? liftedGroups.map(([geometryKey, group]) => (
                  <TerrainRimPieces
                      {...pieceProps}
                      key={geometryKey}
                      geometryKey={geometryKey}
                      lifted
                      placements={group}
                  />
              ))
            : null;
    return (
        <>
            {resting.map(([geometryKey, group]) => (
                <TerrainRimPieces
                    {...pieceProps}
                    key={geometryKey}
                    geometryKey={geometryKey}
                    placements={group}
                />
            ))}
            {lifted && outlineLifted ? (
                <HoverOutline {...blockPickupOutlineStyle} hovered>
                    {lifted}
                </HoverOutline>
            ) : (
                lifted
            )}
        </>
    );
}

function TerrainRimLip({
    geometries,
    liftedPlacements,
    outlineLifted,
    placements,
    sourceMaterial,
    surface,
    weather,
}: TerrainRimLipProps & {
    sourceMaterial: Material | Material[];
    surface: TerrainRimSurface;
}) {
    // The same patched material as the block top, so the lip continues it,
    // one per source shared by the garden and the HUD preview. Gravel and
    // stone have no ground patch and use their material as is.
    const source = Array.isArray(sourceMaterial) ? null : sourceMaterial;
    const patchSurface =
        surface === 'gravel' ||
        surface === 'stone' ||
        surface === 'polishedStone'
            ? null
            : surface;
    const patched = useSharedTerrainRimResource(
        terrainRimMaterials,
        source instanceof MeshStandardMaterial && patchSurface
            ? {
                  key: `lip:${patchSurface}:${source.uuid}`,
                  create: () =>
                      createGroundPatchMaterial(source, patchSurface, {}),
              }
            : null,
    );
    const material = patched ?? source;
    const lipSnow = lipSnowBySurface[surface];
    const snowLies = useSnowOverlayVisible({
        coverageMultiplier:
            'coverageMultiplier' in lipSnow
                ? lipSnow.coverageMultiplier
                : undefined,
        minCoverage: weather.snowOverlayMinCoverage,
    });
    if (!material) return null;
    const lipWeather = {
        ...weather,
        snow: lipSnow,
        snowLift: lipSnowLiftBySurface[surface],
    };
    return (
        <TerrainRimPieceKinds
            geometries={geometries}
            instanceKey={`TerrainRim:Lip:${surface}`}
            liftedPlacements={liftedPlacements}
            material={material}
            outlineLifted={outlineLifted}
            placements={placements}
            set={snowLies && weather.renderSnow !== false ? 'snowLip' : 'lip'}
            weather={lipWeather}
        />
    );
}

type TerrainRimLipProps = TerrainRimPieceSets & {
    geometries: RimGeometries;
    weather: TerrainRimWeatherProps;
};

function GrassTerrainRimLip(props: TerrainRimLipProps) {
    const { nodes } = useGameGLTF('BlockGrass');
    return (
        <TerrainRimLip
            {...props}
            sourceMaterial={nodes.Block_Grass_1_2.material}
            surface="grass"
        />
    );
}

function DirtTerrainRimLip(props: TerrainRimLipProps) {
    const { nodes } = useGameGLTF('BlockGround');
    return (
        <TerrainRimLip
            {...props}
            sourceMaterial={nodes.Block_Ground_1.material}
            surface="dirt"
        />
    );
}

function SandTerrainRimLip(props: TerrainRimLipProps) {
    const { nodes } = useGameGLTF('BlockSand');
    return (
        <TerrainRimLip
            {...props}
            sourceMaterial={nodes.Block_Sand_1.material}
            surface="sand"
        />
    );
}

function GravelTerrainRimLip(props: TerrainRimLipProps) {
    const { nodes } = useGameGLTF('BlockGravel');
    return (
        <TerrainRimLip
            {...props}
            sourceMaterial={nodes.Block_Gravel_Base.material}
            surface="gravel"
        />
    );
}

function StoneTerrainRimLip(props: TerrainRimLipProps) {
    const { nodes } = useGameGLTF('BlockStone');
    return (
        <TerrainRimLip
            {...props}
            sourceMaterial={nodes.Block_Stone_Mid.material}
            surface="stone"
        />
    );
}

function PolishedStoneTerrainRimLip(props: TerrainRimLipProps) {
    const { nodes } = useGameGLTF('BlockPolishedStone');
    return (
        <TerrainRimLip
            {...props}
            sourceMaterial={nodes.Block_Polished_Stone.material}
            surface="polishedStone"
        />
    );
}

/** A flat ground colour owned by code, as the matching blocks draw it. */
function useCodeGroundMaterial(color: string) {
    return useSharedTerrainRimResource(terrainRimMaterials, {
        key: `ground:${color}`,
        create: () =>
            new MeshStandardMaterial({
                color,
                roughness: 0.8,
                metalness: 0,
            }),
    });
}

function SnowTerrainRimLip(props: TerrainRimLipProps) {
    const material = useCodeGroundMaterial(groundSurfaceColors.snow);
    return (
        <TerrainRimLip {...props} sourceMaterial={material} surface="snow" />
    );
}

function DryDirtTerrainRimLip(props: TerrainRimLipProps) {
    const material = useCodeGroundMaterial(dryGroundBaseColor);
    return (
        <TerrainRimLip {...props} sourceMaterial={material} surface="dryDirt" />
    );
}

function SwampDirtTerrainRimLip(props: TerrainRimLipProps) {
    const material = useCodeGroundMaterial(groundSurfaceColors.swampDirt);
    return (
        <TerrainRimLip
            {...props}
            sourceMaterial={material}
            surface="swampDirt"
        />
    );
}

const lipComponentBySurface = {
    dirt: DirtTerrainRimLip,
    dryDirt: DryDirtTerrainRimLip,
    grass: GrassTerrainRimLip,
    gravel: GravelTerrainRimLip,
    polishedStone: PolishedStoneTerrainRimLip,
    sand: SandTerrainRimLip,
    snow: SnowTerrainRimLip,
    stone: StoneTerrainRimLip,
    swampDirt: SwampDirtTerrainRimLip,
} satisfies Record<TerrainRimSurface, (props: TerrainRimLipProps) => unknown>;

type TerrainRimBodyProps = TerrainRimPieceSets & {
    geometries: RimGeometries;
};

function TerrainRimBodyPieces({
    body,
    geometries,
    material,
    ...sets
}: TerrainRimBodyProps & { body: TerrainRimBody; material: Material }) {
    return (
        <TerrainRimPieceKinds
            {...sets}
            geometries={geometries}
            instanceKey={`TerrainRim:Body:${body}`}
            material={material}
            set="body"
        />
    );
}

function SoilTerrainRimBody(props: TerrainRimBodyProps) {
    const material = useTerrainRimSoilMaterial();
    return <TerrainRimBodyPieces {...props} body="soil" material={material} />;
}

/** Stone blocks are stone right through: the wall is the paving bed. */
function StoneTerrainRimBody(props: TerrainRimBodyProps) {
    const { nodes } = useGameGLTF('BlockStone');
    const material = nodes.Block_Stone_Dark.material;
    if (Array.isArray(material)) return null;
    return <TerrainRimBodyPieces {...props} body="stone" material={material} />;
}

function PolishedStoneTerrainRimBody(props: TerrainRimBodyProps) {
    const { nodes } = useGameGLTF('BlockPolishedStone');
    const material = nodes.Block_Polished_Stone.material;
    if (Array.isArray(material)) return null;
    return (
        <TerrainRimBodyPieces
            {...props}
            body="polishedStone"
            material={material}
        />
    );
}

const bodyComponentByKind = {
    polishedStone: PolishedStoneTerrainRimBody,
    soil: SoilTerrainRimBody,
    stone: StoneTerrainRimBody,
} satisfies Record<TerrainRimBody, (props: TerrainRimBodyProps) => unknown>;

/** Groups resting and lifted pieces by the material that draws them. */
function groupPieceSets<TKey>(
    placements: readonly RimPlacement[],
    liftedPlacements: readonly RimPlacement[],
    keyOf: (placement: RimPlacement) => TKey | null,
) {
    const grouped = new Map<
        TKey,
        { liftedPlacements: RimPlacement[]; placements: RimPlacement[] }
    >();
    const add = (
        placement: RimPlacement,
        set: 'liftedPlacements' | 'placements',
    ) => {
        const key = keyOf(placement);
        if (key === null) return;
        let group = grouped.get(key);
        if (!group) {
            group = { liftedPlacements: [], placements: [] };
            grouped.set(key, group);
        }
        group[set].push(placement);
    };
    for (const placement of placements) add(placement, 'placements');
    for (const placement of liftedPlacements)
        add(placement, 'liftedPlacements');
    return [...grouped.entries()];
}

function rimSurface(placement: RimPlacement) {
    return isTerrainRimBlockName(placement.block.name)
        ? terrainRimSurfaceOf(placement.block.name)
        : null;
}

const noPlacements: readonly RimPlacement[] = [];

/**
 * Draws the rim pieces grouped by body and lip material. The lifted pieces
 * of a material are drawn by the same component as its resting ones.
 */
function TerrainRimLayer({
    geometries,
    liftedPlacements,
    outlineLifted,
    placements,
    weather,
}: TerrainRimPieceSets & {
    geometries: RimGeometries;
    weather: TerrainRimWeatherProps;
}) {
    const bodyGroups = useMemo(
        () =>
            groupPieceSets(placements, liftedPlacements, (placement) => {
                const surface = rimSurface(placement);
                return surface ? terrainRimBodyForSurface(surface) : null;
            }),
        [liftedPlacements, placements],
    );
    const lipGroups = useMemo(
        () =>
            groupPieceSets(placements, liftedPlacements, (placement) =>
                placement.hasLip ? rimSurface(placement) : null,
            ),
        [liftedPlacements, placements],
    );

    return (
        <>
            {bodyGroups.map(([body, sets]) => {
                const Body = bodyComponentByKind[body];
                return (
                    <Suspense fallback={null} key={`body:${body}`}>
                        <Body
                            {...sets}
                            geometries={geometries}
                            outlineLifted={outlineLifted}
                        />
                    </Suspense>
                );
            })}
            {lipGroups.map(([surface, sets]) => {
                const Lip = lipComponentBySurface[surface];
                return (
                    <Suspense fallback={null} key={surface}>
                        <Lip
                            {...sets}
                            geometries={geometries}
                            outlineLifted={outlineLifted}
                            weather={weather}
                        />
                    </Suspense>
                );
            })}
        </>
    );
}

/**
 * The drag preview while it holds terrain blocks of `stacks` up, else null.
 * Drags of props leave the rim and verge alone and do not re-render them.
 */
export function useTerrainDragPreview(stacks: Stack[] | undefined) {
    const terrainTargetKeys = useMemo(
        () => createTerrainDragTargetKeys(stacks),
        [stacks],
    );
    return useGameState((state) =>
        dragPreviewLiftsTerrain(state.activeDragPreview, terrainTargetKeys)
            ? state.activeDragPreview
            : null,
    );
}

/**
 * Rounded lip and body on every exposed terrain side. Terrain blocks
 * themselves stay flush cubes, so the floor reads as one surface and only its
 * outer edge is shaped. Soil-like ground shows a soil body under its lip;
 * stone shows stone.
 *
 * While a drag holds terrain blocks up, the garden is rimmed without them and
 * each lifted block carries a rim of its own, so it looks in the air as it
 * does on the ground. Its pieces join the block's pickup outline.
 */
export function TerrainRimInstances({
    stacks,
    ...weather
}: {
    stacks: Stack[] | undefined;
} & TerrainRimWeatherProps) {
    const blockData = useSceneBlockData();
    const dragPreview = useTerrainDragPreview(stacks);
    const { lifted, resting } = useMemo(
        () => resolveTerrainRimDragPlacements(blockData, stacks, dragPreview),
        [blockData, dragPreview, stacks],
    );
    const geometries = useTerrainRimGeometries();

    return (
        <TerrainRimLayer
            geometries={geometries}
            liftedPlacements={lifted}
            outlineLifted
            placements={resting}
            weather={weather}
        />
    );
}

const noPreviewOffset = { x: 0, z: 0 };

/**
 * The HUD preview draws its block through the entity component, which has no
 * wet look in rain, so the preview rim stays dry to match its own top.
 */
const previewWeather: TerrainRimWeatherProps = { renderRainWet: false };

/**
 * The rim of a terrain block dragged in from the HUD: the block on its own,
 * rimmed all round, as it is drawn once placed at the edge of the garden.
 * It draws in garden space at `position`, on top of `baseBlocks`, inside
 * the preview's own outline and scale.
 */
export function TerrainRimPreview({
    baseBlocks,
    blockId,
    blockName,
    blockRotation = 0,
    position,
}: {
    baseBlocks: readonly Block[];
    blockId: string;
    blockName: string;
    /** Turns a ramp, corner or stairs rim with the block it wraps. */
    blockRotation?: number;
    position: { x: number; z: number };
}) {
    const { data: blockData } = useBlockData();
    const { x, z } = position;
    const placements = useMemo(() => {
        if (!isTerrainRimBlockName(blockName)) return [];
        const block = {
            id: blockId,
            name: blockName,
            rotation: blockRotation,
        };
        const stack = {
            blocks: [...baseBlocks, block],
            position: new Vector3(x, 0, z),
        };
        return resolveLiftedTerrainRimPlacements(
            blockData,
            [stack],
            {
                relative: noPreviewOffset,
                targets: [
                    {
                        blockId,
                        blockIndex: baseBlocks.length,
                        hoverHeight: 0,
                        stackPosition: { x, z },
                    },
                ],
            },
            0,
        );
    }, [baseBlocks, blockData, blockId, blockName, blockRotation, x, z]);

    if (!placements.length) return null;
    return <TerrainRimPreviewPieces placements={placements} />;
}

/**
 * The rim of blocks about to be placed, resolved by the caller against the
 * garden they will join (Expand rims its whole rectangle of copies at once,
 * so neighbouring copies share one rim). It draws like `TerrainRimPreview`.
 */
export function TerrainRimPlacementsPreview({
    placements,
}: {
    placements: readonly TerrainRimPlacement<Stack>[];
}) {
    if (!placements.length) return null;
    return <TerrainRimPreviewPieces placements={placements} />;
}

/**
 * Kept apart so a preview of a block without a rim holds nothing. The rest
 * draw with the garden rim's geometry and materials (shared resources), so
 * re-entering the garden from the HUD builds and loads nothing.
 */
function TerrainRimPreviewPieces({
    placements,
}: {
    placements: readonly RimPlacement[];
}) {
    const geometries = useTerrainRimGeometries();
    return (
        <TerrainRimLayer
            geometries={geometries}
            liftedPlacements={placements}
            placements={noPlacements}
            weather={previewWeather}
        />
    );
}
