'use client';

import {
    Activity,
    type RefObject,
    Suspense,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    type Group,
    type InstancedMesh,
    type Material,
    Matrix4,
    Vector3,
} from 'three';
import { EntityFactory } from '../../entities/EntityFactory';
import { EntityNeighborStacksContext } from '../../entities/helpers/EntityNeighborStacksContext';
import { EntityPreviewContext } from '../../entities/helpers/EntityPreviewContext';
import { TerrainRimPlacementsPreview } from '../../entities/terrainRim/TerrainRimInstances';
import { useBlockData } from '../../hooks/useBlockData';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { TranslucentPackLayoutItem } from '../../packLayouts/TranslucentPackLayoutItem';
import { SceneSpringAnimationContext } from '../../scene/SceneSpringContext';
import { useSceneRenderRequest } from '../../scene/SceneTime';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    countExpandGhostRimInstances,
    getExpandGhostRimCapacity,
    resolveExpandGhostRimPlacements,
} from './expandGhostRim';
import {
    type ExpandGhostMergedPart,
    type ExpandGhostPartGroup,
    type ExpandGhostVariant,
    type ExpandGhostVariantTemplate,
    loneExpandGhostVariantKey,
    mergeExpandGhostParts,
    resolveExpandGhostVariants,
} from './expandGhostVariants';
import type { ExpandCell } from './expandPointer';
import {
    countGhostTemplateInstances,
    createGhostMaterials,
    disposeGhostMaterials,
    expandGhostDepthRenderOrder,
    expandGhostRenderOrder,
    type GhostMaterialPass,
    type GhostMaterialSet,
    type GhostStyle,
    type GhostTemplateCollection,
    type GhostTemplatePart,
    getExpandGhostOpacity,
    getExpandGhostStyle,
    getGhostPartMaterial,
} from './ghostTemplateParts';
import { createGhostTemplateSettler } from './ghostTemplateSettler';

const renderReason = 'block-expand-preview';
const noRaycast = () => null;
const emptyGhostMaterials: GhostMaterialSet = new Map();
/**
 * How often the template is checked for late changes (an inner Suspense
 * boundary resolving, a texture swapping a material) before it is frozen.
 */
const templateSettleCheckMs = 250;
/**
 * How many checks the rim template gets to draw every resolved piece (an
 * inner boundary still loading) before the checks stop until the next
 * corner change.
 */
const rimSettleMaxChecks = 40;
/**
 * How many checks an empty block template gets before they stop. A
 * boundary that resolves later still collects through `TemplateCommitted`.
 */
const templateSettleMaxWaits = 40;
const noRim: ExpandGhostRimStatus = { partCount: 0, pieceCount: 0 };
const loadingStatus = { kind: 'loading' } as const;
const noCollections: ReadonlyMap<string, GhostTemplateCollection> = new Map();

/**
 * The rim drawn once around the copies of a terrain block: how many
 * instanced meshes draw it and how many rim pieces it has.
 */
export type ExpandGhostRimStatus = { partCount: number; pieceCount: number };

/** What the ghost layer draws, for the handle's test and debug attributes. */
export type ExpandGhostStatus =
    | { kind: 'loading' }
    | {
          kind: 'parts';
          /** Parts drawing the copies, merged over every template. */
          partCount: number;
          rim: ExpandGhostRimStatus;
          /** Templates: one per shape a copy takes (`expandGhostVariants`). */
          variantCount: number;
      }
    | { kind: 'fallback'; reason: string };

/** Whether two statuses would show the same attributes on the handle. */
export function isSameExpandGhostStatus(
    current: ExpandGhostStatus,
    next: ExpandGhostStatus,
) {
    if (current.kind === 'parts' && next.kind === 'parts') {
        return (
            current.partCount === next.partCount &&
            current.variantCount === next.variantCount &&
            current.rim.partCount === next.rim.partCount &&
            current.rim.pieceCount === next.rim.pieceCount
        );
    }
    if (current.kind === 'fallback' && next.kind === 'fallback') {
        return current.reason === next.reason;
    }
    return current.kind === next.kind;
}

/** Runs `onCommit` once its Suspense boundary has committed its siblings. */
function TemplateCommitted({ onCommit }: { onCommit: () => void }) {
    useLayoutEffect(() => {
        onCommit();
    }, [onCommit]);
    return null;
}

/**
 * The block drawn once, hidden: the same entity component a HUD drag
 * preview draws (`EntityFactory`). Its meshes are the source of the ghost
 * copies of one shape; it is never drawn itself. It reads its neighbours
 * only from the template's own stacks (`EntityNeighborStacksContext` and
 * the entity's `stacks`), never from the garden, and is lowered by its base
 * so its parts start at y 0. A terrain block's rim is not part of it: the
 * copies share one rim (`ExpandGhostRim`), as the placed blocks will.
 *
 * Once its parts are collected it is frozen: `Activity` keeps its objects
 * (the ghosts draw their geometry and copies of their materials) but runs
 * every effect cleanup, so the template holds no render lease, frame
 * callback or store subscription while Expand stays open. A Bush, Tulip or
 * Tree would otherwise keep the time-driven material lease, and with it a
 * frame loop, for as long as the rectangle is being edited.
 */
function ExpandGhostTemplate({
    frozen,
    onCommit,
    template,
    templateRef,
}: {
    frozen: boolean;
    onCommit: () => void;
    template: ExpandGhostVariantTemplate;
    templateRef: RefObject<Group | null>;
}) {
    const { baseHeight, block, stack, stacks } = template;

    return (
        <group ref={templateRef} name="BlockExpand:Template" visible={false}>
            <Activity mode={frozen ? 'hidden' : 'visible'}>
                <EntityPreviewContext.Provider value={true}>
                    <EntityNeighborStacksContext.Provider value={stacks}>
                        <SceneSpringAnimationContext.Provider value={false}>
                            <group position={[0, -baseHeight, 0]}>
                                <Suspense fallback={null}>
                                    <EntityFactory
                                        name={block.name}
                                        block={block}
                                        stack={stack}
                                        stacks={stacks}
                                        rotation={block.rotation}
                                        noControl
                                        weatherDisabled
                                    />
                                    <TemplateCommitted onCommit={onCommit} />
                                </Suspense>
                            </group>
                        </SceneSpringAnimationContext.Provider>
                    </EntityNeighborStacksContext.Provider>
                </EntityPreviewContext.Provider>
            </Activity>
        </group>
    );
}

const translation = new Matrix4();
const instance = new Matrix4();

/**
 * Geometries their owner disposed while ghosts still draw them. A template
 * that holds still is frozen, and a frozen template has run its effect
 * cleanups; a component that owns its geometry (water, autumn foliage)
 * disposes it there. A ghost that keeps drawing the geometry makes three
 * upload it again, and that upload is the ghosts' to free.
 */
const ownerDisposedGeometries = new WeakSet<GhostTemplatePart['geometry']>();

/**
 * Frees a ghost part's upload of a geometry its owner disposed, when the
 * part unmounts. The owner's dispose is recorded for every part, also one
 * that mounts later (a part remade at a larger capacity), so each frees
 * the upload it drew. Geometries their owner never disposed are shared and
 * stay untouched.
 */
function useGhostGeometryGuard(geometry: GhostTemplatePart['geometry']) {
    useEffect(() => {
        const handleDispose = () => {
            ownerDisposedGeometries.add(geometry);
        };
        geometry.addEventListener('dispose', handleDispose);
        return () => {
            geometry.removeEventListener('dispose', handleDispose);
            if (ownerDisposedGeometries.has(geometry)) {
                geometry.dispose();
            }
        };
    }, [geometry]);
}

/**
 * A ghost part's materials: its colour pass and, for a `ground` ghost, the
 * depth pass drawn first (see `GhostStyle`).
 */
type GhostPartMaterials = {
    color: Material | Material[];
    depth: Material | Material[] | null;
};

/**
 * The instanced meshes of one ghost part: the colour pass and, for a
 * `ground` ghost, the depth pass before it (`expandGhostDepthRenderOrder`).
 * They share the geometry and get the same matrices.
 */
function GhostPartMeshes({
    capacity,
    colorRef,
    depthRef,
    geometry,
    materials,
    name,
}: {
    capacity: number;
    colorRef: RefObject<InstancedMesh | null>;
    depthRef: RefObject<InstancedMesh | null>;
    geometry: GhostTemplatePart['geometry'];
    materials: GhostPartMaterials;
    /** Object name prefix and label, e.g. `BlockExpand:Ghost` and `0`. */
    name: { prefix: string; label: string };
}) {
    return (
        <>
            {materials.depth ? (
                <instancedMesh
                    ref={depthRef}
                    args={[geometry, materials.depth, capacity]}
                    castShadow={false}
                    receiveShadow={false}
                    frustumCulled={false}
                    name={`${name.prefix}Depth:${name.label}`}
                    raycast={noRaycast}
                    renderOrder={expandGhostDepthRenderOrder}
                />
            ) : null}
            <instancedMesh
                ref={colorRef}
                args={[geometry, materials.color, capacity]}
                castShadow={false}
                receiveShadow={false}
                frustumCulled={false}
                name={`${name.prefix}:${name.label}`}
                raycast={noRaycast}
                renderOrder={materials.depth ? expandGhostRenderOrder : 0}
            />
        </>
    );
}

/** The meshes of a ghost part that are mounted. */
function getMountedGhostMeshes(
    colorRef: RefObject<InstancedMesh | null>,
    depthRef: RefObject<InstancedMesh | null>,
) {
    return [colorRef.current, depthRef.current].filter(
        (mesh): mesh is InstancedMesh => mesh !== null,
    );
}

/**
 * Writes a merged part's instance matrices: every group's matrices on every
 * cell of its group, on the copies' surface. Returns how many it wrote.
 */
function writeGhostPartMatrices(
    mesh: InstancedMesh,
    groups: readonly ExpandGhostPartGroup[],
    baseHeight: number,
    capacity: number,
) {
    let count = 0;
    for (const group of groups) {
        for (const cell of group.cells) {
            translation.makeTranslation(cell.x, baseHeight, cell.z);
            for (const local of group.localMatrices) {
                if (count >= capacity) {
                    return count;
                }
                instance.multiplyMatrices(translation, local);
                mesh.setMatrixAt(count, instance);
                count++;
            }
        }
    }
    return count;
}

/**
 * One part of the copies drawn at every copy cell that has it: one
 * instanced mesh per pass, however many copies and shapes (one or two
 * passes, see `GhostStyle`). Its instance buffers hold `capacity`
 * instances, so a corner change only rewrites matrices.
 */
function ExpandGhostPart({
    baseHeight,
    capacity,
    index,
    materials,
    part,
}: {
    baseHeight: number;
    capacity: number;
    index: number;
    materials: GhostPartMaterials;
    part: ExpandGhostMergedPart;
}) {
    const colorRef = useRef<InstancedMesh>(null);
    const depthRef = useRef<InstancedMesh>(null);
    const requestRender = useSceneRenderRequest();
    useGhostGeometryGuard(part.geometry);

    useLayoutEffect(() => {
        for (const mesh of getMountedGhostMeshes(colorRef, depthRef)) {
            const count = writeGhostPartMatrices(
                mesh,
                part.groups,
                baseHeight,
                capacity,
            );
            mesh.count = count;
            // An empty rectangle hides the part instead of unmounting it, so
            // the part keeps track of its geometry while Expand is open.
            mesh.visible = count > 0;
            mesh.instanceMatrix.needsUpdate = true;
        }
        requestRender(renderReason);
    }, [baseHeight, capacity, part.groups, requestRender]);

    return (
        <GhostPartMeshes
            capacity={capacity}
            colorRef={colorRef}
            depthRef={depthRef}
            geometry={part.geometry}
            materials={materials}
            name={{ prefix: 'BlockExpand:Ghost', label: String(index) }}
        />
    );
}

/**
 * One rim part drawn once, where the rim template draws it: its matrices
 * already place every piece around the copies. The parent sizes its
 * instance buffer (`getExpandGhostRimCapacity`) and keys it by that size.
 */
function ExpandGhostRimPart({
    capacity,
    hidden,
    index,
    materials,
    part,
}: {
    capacity: number;
    /** No rim right now (the corner is on the source): draw nothing. */
    hidden: boolean;
    index: number;
    materials: GhostPartMaterials;
    part: GhostTemplatePart;
}) {
    const colorRef = useRef<InstancedMesh>(null);
    const depthRef = useRef<InstancedMesh>(null);
    const requestRender = useSceneRenderRequest();
    useGhostGeometryGuard(part.geometry);

    useLayoutEffect(() => {
        const count = hidden
            ? 0
            : Math.min(part.localMatrices.length, capacity);
        for (const mesh of getMountedGhostMeshes(colorRef, depthRef)) {
            for (let at = 0; at < count; at++) {
                const matrix = part.localMatrices[at];
                if (matrix) {
                    mesh.setMatrixAt(at, matrix);
                }
            }
            mesh.count = count;
            mesh.visible = count > 0;
            mesh.instanceMatrix.needsUpdate = true;
        }
        requestRender(renderReason);
    }, [capacity, hidden, part.localMatrices, requestRender]);

    return (
        <GhostPartMeshes
            capacity={capacity}
            colorRef={colorRef}
            depthRef={depthRef}
            geometry={part.geometry}
            materials={materials}
            name={{ prefix: 'BlockExpand:GhostRim', label: String(index) }}
        />
    );
}

/**
 * Keeps one ghost material per template material for one pass, reused
 * across collections. While there are no parts (the corner back on the
 * source cell empties the rim) the last materials are kept, so stretching
 * out again compiles no shader; they are freed when other parts replace
 * them or the layer unmounts.
 */
function useGhostMaterialSet(
    parts: readonly Pick<GhostTemplatePart, 'material'>[] | null,
    pass: GhostMaterialPass,
    opacity: number,
) {
    const materialsRef = useRef<GhostMaterialSet>(emptyGhostMaterials);
    const materials = useMemo(
        () =>
            parts && parts.length > 0
                ? createGhostMaterials(parts, materialsRef.current, {
                      opacity,
                      pass,
                  })
                : materialsRef.current,
        [opacity, parts, pass],
    );

    useEffect(() => {
        const previous = materialsRef.current;
        materialsRef.current = materials;
        disposeGhostMaterials(previous, materials);
    }, [materials]);
    useEffect(
        () => () => {
            disposeGhostMaterials(materialsRef.current);
            materialsRef.current = emptyGhostMaterials;
        },
        [],
    );

    return materials;
}

/**
 * Parts with their materials for the passes of `style`, keyed by geometry
 * and source materials (and `keyOf` extras).
 */
function useGhostParts<
    Part extends Pick<GhostTemplatePart, 'geometry' | 'material'>,
>(
    parts: readonly Part[] | null,
    style: GhostStyle,
    keyOf: (part: Part) => string = noPartKeySuffix,
) {
    const opacity = getExpandGhostOpacity(style);
    const solid = style === 'ground';
    const color = useGhostMaterialSet(parts, 'color', opacity);
    const depth = useGhostMaterialSet(solid ? parts : null, 'depth', opacity);
    return useMemo(() => {
        if (!parts) {
            return [];
        }

        return parts.flatMap((part) => {
            const colorMaterial = getGhostPartMaterial(part, color);
            const depthMaterial = solid
                ? getGhostPartMaterial(part, depth)
                : null;
            if (!colorMaterial || (solid && !depthMaterial)) {
                return [];
            }
            const sources = Array.isArray(part.material)
                ? part.material
                : [part.material];
            const key = `${part.geometry.uuid}|${sources
                .map((source) => source.uuid)
                .join(',')}${keyOf(part)}`;
            const materials: GhostPartMaterials = {
                color: colorMaterial,
                depth: depthMaterial,
            };
            return [{ key, materials, part }];
        });
    }, [color, depth, keyOf, parts, solid]);
}

function noPartKeySuffix() {
    return '';
}

/** The rim instance buffer size, part of a rim part's key. */
function getRimPartKey(part: GhostTemplatePart) {
    return `|${getExpandGhostRimCapacity(part.localMatrices.length)}`;
}

/** The pieces of the copies' shared rim; empty for blocks without one. */
function useExpandGhostRimPlacements({
    blockName,
    cells,
    rotation,
}: {
    blockName: string;
    cells: readonly ExpandCell[];
    rotation: number;
}) {
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const stacks = garden?.stacks;
    return useMemo(
        () =>
            resolveExpandGhostRimPlacements({
                blockData,
                blockName,
                cells,
                rotation,
                stacks,
            }),
        [blockData, blockName, cells, rotation, stacks],
    );
}

/**
 * The rim the copies of a terrain block wear once placed, drawn once around
 * the whole rectangle (`resolveExpandGhostRimPlacements`): only the outer
 * edge of the new area gets a lip and body, and copies merge with the source
 * and level terrain beside them. A hidden template draws the pieces with the
 * garden rim's own geometry and materials (`TerrainRimPlacementsPreview`);
 * each of its parts becomes one see-through instanced mesh with the same
 * matrices. The template follows the corner (it holds no render lease or
 * frame callback), so it is collected after every change and checked a few
 * times a second only until every resolved piece is drawn.
 */
function ExpandGhostRim({
    blockName,
    cells,
    onStatusChange,
    rotation,
}: {
    blockName: string;
    cells: readonly ExpandCell[];
    onStatusChange: (status: ExpandGhostRimStatus) => void;
    rotation: number;
}) {
    const placements = useExpandGhostRimPlacements({
        blockName,
        cells,
        rotation,
    });
    const expectedInstances = countExpandGhostRimInstances(placements);
    const templateRef = useRef<Group>(null);
    // The rim follows the corner and is never frozen; it is drawn once, so
    // its instanced pieces are collected without the per-mesh cap.
    const [settler] = useState(() =>
        createGhostTemplateSettler({
            maxInstancesPerMesh: Number.POSITIVE_INFINITY,
        }),
    );
    const [collection, setCollection] =
        useState<GhostTemplateCollection | null>(null);
    const requestRender = useSceneRenderRequest();

    /** Collects the rim's parts again when it changed. */
    const collect = useCallback(() => {
        if (settler.collect(templateRef.current)) {
            setCollection(settler.collection);
        }
    }, [settler]);

    // Runs after the template's own layout effects have written the piece
    // matrices for these placements. A block without a rim never collects.
    useLayoutEffect(() => {
        if (placements.length > 0 || settler.collection !== null) {
            collect();
        }
    }, [collect, placements, settler]);

    // A piece group that is still loading (its Suspense boundary) draws
    // late; the rim is checked until every resolved piece is drawn.
    useEffect(() => {
        if (
            countGhostTemplateInstances(settler.collection) >= expectedInstances
        ) {
            return;
        }

        let checks = 0;
        const timer = window.setInterval(() => {
            collect();
            checks++;
            if (
                checks >= rimSettleMaxChecks ||
                countGhostTemplateInstances(settler.collection) >=
                    expectedInstances
            ) {
                window.clearInterval(timer);
            }
        }, templateSettleCheckMs);
        return () => window.clearInterval(timer);
    }, [collect, expectedInstances, settler]);

    // With no rim (the corner back on the source cell) the last rim parts
    // stay mounted and hidden, as the lone copies' parts do: unmounted, the
    // scene would let go of their materials and compile them again when the
    // rectangle grows.
    const liveParts =
        collection?.kind === 'parts' && collection.parts.length > 0
            ? collection.parts
            : null;
    const [keptParts, setKeptParts] = useState(liveParts);
    if (liveParts !== null && liveParts !== keptParts) {
        setKeptParts(liveParts);
    }
    const rimHidden = liveParts === null;
    // The rim only ever wraps ground copies.
    const rimParts = useGhostParts(
        liveParts ?? keptParts,
        'ground',
        getRimPartKey,
    );
    const shownPartCount = rimHidden ? 0 : rimParts.length;

    useEffect(() => {
        requestRender(renderReason);
        onStatusChange({
            partCount: shownPartCount,
            pieceCount: placements.length,
        });
    }, [onStatusChange, placements.length, requestRender, shownPartCount]);

    return (
        <group name="BlockExpand:Rim">
            <group
                ref={templateRef}
                name="BlockExpand:RimTemplate"
                visible={false}
            >
                <Suspense fallback={null}>
                    <TerrainRimPlacementsPreview placements={placements} />
                </Suspense>
            </group>
            {rimParts.map(({ key, materials, part }, index) => (
                <ExpandGhostRimPart
                    key={key}
                    capacity={getExpandGhostRimCapacity(
                        part.localMatrices.length,
                    )}
                    hidden={rimHidden}
                    index={index}
                    materials={materials}
                    part={part}
                />
            ))}
        </group>
    );
}

/**
 * One template, hidden: collected while it settles, then frozen
 * (`ghostTemplateSettler`). It reports each collection to the ghost layer,
 * which draws the parts of every template together.
 */
function ExpandGhostTemplateSlot({
    onCollection,
    template,
    variantKey,
}: {
    onCollection: (
        variantKey: string,
        collection: GhostTemplateCollection | null,
    ) => void;
    template: ExpandGhostVariantTemplate;
    variantKey: string;
}) {
    const templateRef = useRef<Group>(null);
    const [settler] = useState(createGhostTemplateSettler);
    const [frozen, setFrozen] = useState(false);

    /** Collects the parts again when the template changed. */
    const collect = useCallback(() => {
        if (settler.collect(templateRef.current)) {
            onCollection(variantKey, settler.collection);
        }
    }, [onCollection, settler, variantKey]);

    // The template group's ref is attached after its children's layout
    // effects, so the first collection runs here, once the whole template
    // has committed. `TemplateCommitted` covers a Suspense boundary that
    // resolves later.
    useLayoutEffect(() => {
        collect();
    }, [collect]);

    // Inner Suspense boundaries can resolve, and a texture can swap a
    // material, after the first collection. The template is checked a few
    // times a second until it holds still with a final result, then frozen;
    // an empty one is checked for 10 s at most. The settler marks itself
    // frozen and the timer stops before the freeze hides the template, so
    // no later check can collect the hidden template and lose its parts.
    // No frame is requested and nothing runs per frame.
    useEffect(() => {
        if (frozen) {
            return;
        }

        let waits = 0;
        const timer = window.setInterval(() => {
            const result = settler.settle(templateRef.current);
            if (result === 'changed') {
                onCollection(variantKey, settler.collection);
            } else if (result === 'frozen') {
                window.clearInterval(timer);
                setFrozen(true);
            } else {
                waits++;
                if (waits >= templateSettleMaxWaits) {
                    window.clearInterval(timer);
                }
            }
        }, templateSettleCheckMs);
        return () => window.clearInterval(timer);
    }, [frozen, onCollection, settler, variantKey]);

    // A remounted slot (Strict Mode, or the shape coming back) reports the
    // collection it already holds.
    useEffect(() => {
        if (settler.collection) {
            onCollection(variantKey, settler.collection);
        }
        return () => onCollection(variantKey, null);
    }, [onCollection, settler, variantKey]);

    return (
        <ExpandGhostTemplate
            frozen={frozen}
            onCommit={collect}
            template={template}
            templateRef={templateRef}
        />
    );
}

/**
 * The templates the copies draw (`resolveExpandGhostVariants`), with each
 * shape's template object kept from the first time the shape appeared. A
 * template is mounted and frozen once per shape; new objects for the same
 * shape would render the frozen template again.
 */
function useExpandGhostVariants({
    blockName,
    cells,
    rotation,
}: {
    blockName: string;
    cells: readonly ExpandCell[];
    rotation: number;
}) {
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const stacks = garden?.stacks;
    const templatesRef = useRef<
        ReadonlyMap<string, ExpandGhostVariantTemplate>
    >(new Map());
    const variants = useMemo(
        () =>
            resolveExpandGhostVariants({
                blockData,
                blockName,
                cells,
                rotation,
                stacks,
            }).map((variant) => {
                const template = templatesRef.current.get(variant.key);
                return template ? { ...variant, template } : variant;
            }),
        [blockData, blockName, cells, rotation, stacks],
    );

    useEffect(() => {
        templatesRef.current = new Map(
            variants.map((variant) => [variant.key, variant.template]),
        );
    }, [variants]);

    return variants;
}

/** The ghost layer's status from its templates' collections and its rim. */
function getExpandGhostStatus({
    collections,
    partCount,
    rim,
    variants,
}: {
    collections: ReadonlyMap<string, GhostTemplateCollection>;
    partCount: number;
    rim: ExpandGhostRimStatus;
    variants: readonly ExpandGhostVariant[];
}): ExpandGhostStatus {
    for (const variant of variants) {
        const collection = collections.get(variant.key);
        if (!collection) {
            return loadingStatus;
        }
        if (collection.kind === 'fallback') {
            return { kind: 'fallback', reason: collection.reason };
        }
    }
    return { kind: 'parts', partCount, rim, variantCount: variants.length };
}

/**
 * A part's instance buffer size. The lone template's parts hold every cell
 * the rectangle can have, so a corner drag never makes a new mesh. Merged
 * parts of shaped copies grow in powers of two, as the rim's.
 */
function getExpandGhostPartCapacity(
    part: ExpandGhostMergedPart,
    lone: boolean,
    capacity: number,
) {
    if (lone) {
        const copiesPerCell = part.groups[0]?.localMatrices.length ?? 1;
        return Math.max(1, capacity * copiesPerCell);
    }
    return getExpandGhostRimCapacity(part.instanceCount);
}

/**
 * See-through copies of the Expand block on every cell that gets one
 * (spec §7.5). The block is drawn as a hidden template; its meshes, minus
 * decoration sprites, overlays and shadows, become one instanced mesh per
 * part with a shared see-through material, so the draw calls do not grow
 * with the rectangle. A fence, shade or water copy looks as it will once
 * placed: copies of each shape share a template that reads the neighbours
 * they will have (`resolveExpandGhostVariants`), and the parts of all
 * shapes are drawn together (`mergeExpandGhostParts`). A terrain block's
 * copies share one rim, drawn once (`ExpandGhostRim`). A skinned or empty
 * template falls back to one see-through entity at the corner (the cell
 * plates still mark every copy).
 */
export function ExpandGhostInstances({
    baseHeight,
    blockName,
    capacity,
    cells,
    corner,
    onStatusChange,
    rotation,
}: {
    /** The surface the copies stand on (the source's base). */
    baseHeight: number;
    blockName: string;
    /** The most copies the rectangle can hold (`maxSide²`). */
    capacity: number;
    /** Cells that get a copy. */
    cells: readonly ExpandCell[];
    /** The dragged corner, for the fallback ghost. */
    corner: ExpandCell;
    onStatusChange?: (status: ExpandGhostStatus) => void;
    rotation: number;
}) {
    const variants = useExpandGhostVariants({ blockName, cells, rotation });
    const lone =
        variants.length === 1 && variants[0]?.key === loneExpandGhostVariantKey;
    const [collections, setCollections] = useState(noCollections);
    const handleCollection = useCallback(
        (variantKey: string, collection: GhostTemplateCollection | null) => {
            setCollections((current) => {
                if ((current.get(variantKey) ?? null) === collection) {
                    return current;
                }
                const next = new Map(current);
                if (collection) {
                    next.set(variantKey, collection);
                } else {
                    next.delete(variantKey);
                }
                return next;
            });
        },
        [],
    );
    const mergedParts = useMemo(
        () => mergeExpandGhostParts(variants, collections),
        [collections, variants],
    );
    const ghostParts = useGhostParts(
        mergedParts,
        getExpandGhostStyle(blockName),
    );
    const [rim, setRim] = useState<ExpandGhostRimStatus>(noRim);
    const handleRimStatus = useCallback((next: ExpandGhostRimStatus) => {
        setRim((current) =>
            current.partCount === next.partCount &&
            current.pieceCount === next.pieceCount
                ? current
                : next,
        );
    }, []);
    const requestRender = useSceneRenderRequest();
    const status = useMemo(
        () =>
            getExpandGhostStatus({
                collections,
                partCount: ghostParts.length,
                rim,
                variants,
            }),
        [collections, ghostParts.length, rim, variants],
    );

    useEffect(() => {
        requestRender(renderReason);
        onStatusChange?.(status);
    }, [onStatusChange, requestRender, status]);

    const fallbackKind = status.kind === 'fallback';
    const fallbackGhost = useMemo(() => {
        if (!fallbackKind) {
            return null;
        }
        const ghostBlock: Block = {
            id: `block-expand-fallback:${blockName}`,
            name: blockName,
            rotation,
        };
        const stack: Stack = {
            blocks: [ghostBlock],
            position: new Vector3(corner.x, 0, corner.z),
        };
        return { block: ghostBlock, stack };
    }, [blockName, corner.x, corner.z, fallbackKind, rotation]);

    return (
        <group name="BlockExpand:Ghosts">
            {variants.map((variant) => (
                <ExpandGhostTemplateSlot
                    key={variant.key}
                    onCollection={handleCollection}
                    template={variant.template}
                    variantKey={variant.key}
                />
            ))}
            {ghostParts.map(({ key, materials, part }, index) => {
                const partCapacity = getExpandGhostPartCapacity(
                    part,
                    lone,
                    capacity,
                );
                return (
                    <ExpandGhostPart
                        key={`${key}|${partCapacity}`}
                        baseHeight={baseHeight}
                        capacity={partCapacity}
                        index={index}
                        materials={materials}
                        part={part}
                    />
                );
            })}
            <ExpandGhostRim
                blockName={blockName}
                cells={cells}
                onStatusChange={handleRimStatus}
                rotation={rotation}
            />
            {cells.length > 0 && fallbackGhost ? (
                <group position={[0, baseHeight, 0]}>
                    <Suspense fallback={null}>
                        <TranslucentPackLayoutItem
                            block={fallbackGhost.block}
                            stack={fallbackGhost.stack}
                            onReady={noopReady}
                        />
                    </Suspense>
                </group>
            ) : null}
        </group>
    );
}

function noopReady() {}
