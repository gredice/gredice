'use client';

import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { Canvas, useThree } from '@react-three/fiber';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { compileGardenStructurePlan } from '../src/structures/compileGardenStructurePlan';
import { debugGardenStructureKitMetadata } from '../src/structures/debugStructureKit';
import { GardenStructureCollectionRenderer } from '../src/structures/GardenStructureCollectionRenderer';
import {
    createGardenStructureCollectionPlan,
    type GardenStructureCollectionBatchDescription,
    type GardenStructureCollectionPlan,
} from '../src/structures/gardenStructureCollectionPlan';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../src/useGameState';

export type GardenStructureKitV1RendererFixtureMode =
    | 'asset-error'
    | 'empty'
    | 'incompatible-portal-prop'
    | 'missing'
    | 'portal-asset-error'
    | 'portal-missing-mixed'
    | 'prop-fallback-asset-error'
    | 'prop-only-hidden-mixed'
    | 'production';

type RendererReadback = Readonly<{
    fallbackInstanceCount: number;
    fallbackMeshCount: number;
    materialNames: readonly string[];
    opaqueDrawCount: number;
    productionNodeNames: readonly string[];
    status: 'ready';
    target: Readonly<{ x: number; y: number }>;
    transparentDrawCount: number;
    unresolvedBatchCount: number;
}>;

function compileFixtureStructure(
    structureId: string,
    templateKey: 'greenhouse' | 'house',
) {
    return compileGardenStructurePlan({
        structureId,
        revision: 1,
        document: createGardenStructureTemplateSeed(templateKey).document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });
}

function createPortalDocument(includeTable: boolean) {
    const seed = createGardenStructureTemplateSeed('blank');
    return Object.freeze({
        ...seed.document,
        edges: Object.freeze([
            Object.freeze({
                id: 'only-open-portal',
                from: Object.freeze({ x: 0, y: 0 }),
                direction: 'north' as const,
                partId: 'door.timber-wide-open',
                kind: 'door' as const,
            }),
        ]),
        props: Object.freeze(
            includeTable
                ? [
                      Object.freeze({
                          id: 'only-table',
                          partId: 'prop.table',
                          x: 0,
                          y: 0,
                          rotation: 0 as const,
                      }),
                  ]
                : [],
        ),
    });
}

function createPropOnlyDocument() {
    const seed = createGardenStructureTemplateSeed('blank');
    return Object.freeze({
        ...seed.document,
        props: Object.freeze([
            Object.freeze({
                id: 'only-table',
                partId: 'prop.table',
                x: 0,
                y: 0,
                rotation: 0 as const,
            }),
        ]),
    });
}

function createIncompatibleFixtureKit() {
    const table = debugGardenStructureKitMetadata.propParts['prop.table'];
    if (!table) {
        throw new Error('Missing fixture table metadata.');
    }
    return Object.freeze({
        ...debugGardenStructureKitMetadata,
        propParts: Object.freeze({
            ...debugGardenStructureKitMetadata.propParts,
            'prop.table': Object.freeze({
                ...table,
                collisionWidth: 0.7,
            }),
        }),
    });
}

const incompatibleFixtureKit = createIncompatibleFixtureKit();

function compilePortalFixtureStructure({
    anchorX,
    includeTable = false,
    incompatible = false,
    structureId,
}: Readonly<{
    anchorX: number;
    includeTable?: boolean;
    incompatible?: boolean;
    structureId: string;
}>) {
    return compileGardenStructurePlan({
        structureId,
        revision: 1,
        document: createPortalDocument(includeTable),
        placement: { anchorX, anchorY: 0, rotation: 0 },
        ...(incompatible ? { kit: incompatibleFixtureKit } : {}),
    });
}

const sourceCollectionPlan = createGardenStructureCollectionPlan([
    {
        kit: debugGardenStructureKitMetadata,
        plan: compileFixtureStructure('fixture-house', 'house'),
    },
    {
        kit: debugGardenStructureKitMetadata,
        plan: compileFixtureStructure('fixture-greenhouse', 'greenhouse'),
    },
]);

const portalSourceCollectionPlan = createGardenStructureCollectionPlan([
    {
        kit: debugGardenStructureKitMetadata,
        plan: compilePortalFixtureStructure({
            anchorX: -2,
            structureId: 'fixture-missing-portal',
        }),
    },
    {
        kit: debugGardenStructureKitMetadata,
        plan: compilePortalFixtureStructure({
            anchorX: 1,
            structureId: 'fixture-resolved-portal',
        }),
    },
]);

const incompatiblePortalPropSourcePlan = createGardenStructureCollectionPlan([
    {
        kit: incompatibleFixtureKit,
        plan: compilePortalFixtureStructure({
            anchorX: 0,
            includeTable: true,
            incompatible: true,
            structureId: 'fixture-incompatible-portal-prop',
        }),
    },
]);

const portalErrorSourcePlan = createGardenStructureCollectionPlan([
    {
        kit: debugGardenStructureKitMetadata,
        plan: compilePortalFixtureStructure({
            anchorX: -1,
            structureId: 'fixture-error-portal',
        }),
    },
    {
        kit: debugGardenStructureKitMetadata,
        plan: compileFixtureStructure('fixture-error-house', 'house'),
    },
]);

const propOnlyHiddenMixedSourcePlan = createGardenStructureCollectionPlan([
    {
        kit: debugGardenStructureKitMetadata,
        plan: compileGardenStructurePlan({
            structureId: 'fixture-hidden-prop-only',
            revision: 1,
            document: createPropOnlyDocument(),
            placement: { anchorX: -2, anchorY: 0, rotation: 0 },
        }),
    },
    {
        kit: debugGardenStructureKitMetadata,
        plan: compilePortalFixtureStructure({
            anchorX: 1,
            structureId: 'fixture-visible-portal-peer',
        }),
    },
]);

const propFallbackErrorSourcePlan = createGardenStructureCollectionPlan([
    {
        kit: debugGardenStructureKitMetadata,
        plan: compileGardenStructurePlan({
            structureId: 'fixture-error-a-prop-only',
            revision: 1,
            document: createPropOnlyDocument(),
            placement: { anchorX: -1, anchorY: 0, rotation: 0 },
        }),
    },
    {
        kit: debugGardenStructureKitMetadata,
        plan: compilePortalFixtureStructure({
            anchorX: 1,
            includeTable: true,
            structureId: 'fixture-error-b-portal-prop',
        }),
    },
]);

function requireBatch(
    batches: readonly GardenStructureCollectionBatchDescription[],
    geometryId: string,
) {
    const batch = batches.find(
        (candidate) => candidate.geometryId === geometryId,
    );
    if (!batch) {
        throw new Error(`Missing fixture batch ${geometryId}.`);
    }
    return batch;
}

function isolateBatch(
    batch: GardenStructureCollectionBatchDescription,
    id: string,
    instanceId: string,
    structureId: string,
    x: number,
) {
    return Object.freeze({
        ...batch,
        id,
        instanceIds: Object.freeze([instanceId]),
        structureIds: Object.freeze([structureId]),
        transforms: new Float32Array([x, 0, 0, 0]),
    }) satisfies GardenStructureCollectionBatchDescription;
}

function isolateBatchForStructure(
    batch: GardenStructureCollectionBatchDescription,
    id: string,
    structureId: string,
) {
    const sourceIndices = batch.structureIds.flatMap((candidate, index) =>
        candidate === structureId ? [index] : [],
    );
    if (sourceIndices.length === 0) {
        throw new Error(`Missing fixture batch structure ${structureId}.`);
    }
    return Object.freeze({
        ...batch,
        id,
        instanceIds: Object.freeze(
            sourceIndices.flatMap((index) => {
                const instanceId = batch.instanceIds[index];
                return instanceId ? [instanceId] : [];
            }),
        ),
        structureIds: Object.freeze(sourceIndices.map(() => structureId)),
        transforms: new Float32Array(
            sourceIndices.flatMap((index) => {
                const offset = index * batch.transformStride;
                return Array.from(
                    batch.transforms.slice(
                        offset,
                        offset + batch.transformStride,
                    ),
                );
            }),
        ),
    }) satisfies GardenStructureCollectionBatchDescription;
}

const tableBatch = isolateBatch(
    requireBatch(sourceCollectionPlan.batches.props, 'prop.table'),
    'fixture:table',
    'fixture-table-instance',
    'fixture-house',
    -0.8,
);
const greenhouseWallBatch = isolateBatch(
    requireBatch(
        sourceCollectionPlan.batches.transparent,
        'wall.greenhouse-panel',
    ),
    'fixture:greenhouse-wall',
    'fixture-greenhouse-wall-instance',
    'fixture-greenhouse',
    0.8,
);
const missingBatch = Object.freeze({
    ...tableBatch,
    geometryId: 'prop.fixture-missing-node',
    id: 'fixture:missing',
    instanceIds: Object.freeze(['fixture-fallback-instance']),
    materialId: 'prop.fixture-missing-node',
    structureIds: Object.freeze(['fixture-missing-structure']),
    transforms: new Float32Array([0, 0, 0, 0]),
}) satisfies GardenStructureCollectionBatchDescription;

const sharedPortalBatch = requireBatch(
    portalSourceCollectionPlan.batches.opaque,
    'door.timber-wide-open',
);
const missingPortalBatch = Object.freeze({
    ...isolateBatchForStructure(
        sharedPortalBatch,
        'fixture:missing-portal',
        'fixture-missing-portal',
    ),
    geometryId: 'door.fixture-missing-open-portal',
    materialId: 'door.fixture-missing-open-portal',
}) satisfies GardenStructureCollectionBatchDescription;
const resolvedPortalBatch = isolateBatchForStructure(
    sharedPortalBatch,
    'fixture:resolved-portal',
    'fixture-resolved-portal',
);
const sharedPortalFootprintBatch = requireBatch(
    portalSourceCollectionPlan.batches.transparent,
    'semantic-footprint',
);

const portalErrorBatch = requireBatch(
    portalErrorSourcePlan.batches.opaque,
    'door.timber-wide-open',
);
const portalErrorTableBatch = requireBatch(
    portalErrorSourcePlan.batches.props,
    'prop.table',
);
const portalErrorFootprintBatch = requireBatch(
    portalErrorSourcePlan.batches.transparent,
    'semantic-footprint',
);

function withFixtureBatches(
    source: GardenStructureCollectionPlan,
    mode: string,
    batches: GardenStructureCollectionPlan['batches'],
) {
    return Object.freeze({
        ...source,
        batches: Object.freeze(batches),
        cacheKey: `fixture:${mode}`,
        id: `fixture:${mode}`,
    }) satisfies GardenStructureCollectionPlan;
}

function fixturePlan(
    mode: Exclude<GardenStructureKitV1RendererFixtureMode, 'empty'>,
): GardenStructureCollectionPlan {
    if (mode === 'incompatible-portal-prop') {
        return withFixtureBatches(
            incompatiblePortalPropSourcePlan,
            mode,
            incompatiblePortalPropSourcePlan.batches,
        );
    }
    if (mode === 'portal-missing-mixed') {
        return withFixtureBatches(portalSourceCollectionPlan, mode, {
            opaque: Object.freeze([missingPortalBatch, resolvedPortalBatch]),
            props: Object.freeze([]),
            roof: Object.freeze([]),
            transparent: Object.freeze([sharedPortalFootprintBatch]),
        });
    }
    if (mode === 'portal-asset-error') {
        return withFixtureBatches(portalErrorSourcePlan, mode, {
            opaque: Object.freeze([portalErrorBatch]),
            props: Object.freeze([portalErrorTableBatch]),
            roof: Object.freeze([]),
            transparent: Object.freeze([portalErrorFootprintBatch]),
        });
    }
    if (mode === 'prop-fallback-asset-error') {
        return withFixtureBatches(
            propFallbackErrorSourcePlan,
            mode,
            propFallbackErrorSourcePlan.batches,
        );
    }
    if (mode === 'prop-only-hidden-mixed') {
        return withFixtureBatches(
            propOnlyHiddenMixedSourcePlan,
            mode,
            propOnlyHiddenMixedSourcePlan.batches,
        );
    }
    const useProductionBatches =
        mode === 'asset-error' || mode === 'production';
    return withFixtureBatches(sourceCollectionPlan, mode, {
        opaque: Object.freeze([]),
        props: Object.freeze(
            useProductionBatches ? [tableBatch] : [missingBatch],
        ),
        roof: Object.freeze([]),
        transparent: Object.freeze(
            useProductionBatches ? [greenhouseWallBatch] : [],
        ),
    });
}

function CameraTarget() {
    const camera = useThree((state) => state.camera);
    useEffect(() => {
        camera.lookAt(0, 0.8, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    return null;
}

function FixtureGameStateProvider({ children }: { children: ReactNode }) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: '',
            freezeTime: null,
            isMock: true,
        });
    }
    useDisposeGameStateStore(storeRef.current);
    return (
        <GameStateContext.Provider value={storeRef.current}>
            {children}
        </GameStateContext.Provider>
    );
}

function materialNames(mesh: InstancedMesh) {
    return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(
        ({ name }) => name,
    );
}

function RendererProbe({
    mode,
    onReady,
}: Readonly<{
    mode: Exclude<GardenStructureKitV1RendererFixtureMode, 'empty'>;
    onReady: (readback: RendererReadback) => void;
}>) {
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);
    const size = useThree((state) => state.size);
    const published = useRef(false);

    useEffect(() => {
        let frame = 0;
        const inspect = () => {
            if (published.current) {
                return;
            }
            const asset = scene.getObjectByName(
                'GardenStructureCollectionKitV1Batch:Asset',
            );
            const fullFallback = scene.getObjectByName(
                'GardenStructures:CollectionSemanticFallback',
            );
            const collection = scene.getObjectByName(
                'GardenStructures:Collection',
            );
            if (
                (mode === 'portal-missing-mixed' ||
                    mode === 'prop-only-hidden-mixed') &&
                !asset
            ) {
                frame = window.requestAnimationFrame(inspect);
                return;
            }
            const inspectedRoot = collection ?? asset ?? fullFallback;
            if (!inspectedRoot) {
                frame = window.requestAnimationFrame(inspect);
                return;
            }

            scene.updateMatrixWorld(true);
            const productionMeshes: InstancedMesh[] = [];
            const fallbackMeshes: InstancedMesh[] = [];
            inspectedRoot.traverse((object) => {
                if (!(object instanceof InstancedMesh)) {
                    return;
                }
                if (object.userData.semanticFallback === true) {
                    fallbackMeshes.push(object);
                } else if (object.userData.semanticFallback === false) {
                    productionMeshes.push(object);
                }
            });
            const target =
                mode === 'production'
                    ? productionMeshes.find(
                          ({ userData }) =>
                              userData.sourcePrimitiveNodeName ===
                              'GardenStructureKitV1_PropTable_Mesh',
                      )
                    : mode === 'portal-asset-error' ||
                        mode === 'portal-missing-mixed' ||
                        mode === 'prop-only-hidden-mixed'
                      ? fallbackMeshes.find(({ name }) =>
                            name.includes('semantic-footprint'),
                        )
                      : fallbackMeshes[0];
            if (!target) {
                frame = window.requestAnimationFrame(inspect);
                return;
            }

            target.geometry.computeBoundingSphere();
            const instanceMatrix = new Matrix4();
            target.getMatrixAt(0, instanceMatrix);
            const targetPoint =
                target.geometry.boundingSphere?.center.clone() ?? new Vector3();
            targetPoint
                .applyMatrix4(instanceMatrix)
                .applyMatrix4(target.matrixWorld)
                .project(camera);
            const opaquePass = asset?.getObjectByName(
                'GardenStructureCollectionKitV1Batch:OpaquePass',
            );
            const transparentPass = asset?.getObjectByName(
                'GardenStructureCollectionKitV1Batch:TransparentPass',
            );
            published.current = true;
            onReady({
                fallbackInstanceCount: fallbackMeshes.reduce(
                    (total, mesh) => total + mesh.count,
                    0,
                ),
                fallbackMeshCount: fallbackMeshes.length,
                materialNames: [
                    ...new Set(productionMeshes.flatMap(materialNames)),
                ].toSorted((left, right) => left.localeCompare(right)),
                opaqueDrawCount: opaquePass?.children.length ?? 0,
                productionNodeNames: [
                    ...new Set(
                        productionMeshes.flatMap(({ userData }) =>
                            typeof userData.sourcePrimitiveNodeName === 'string'
                                ? [userData.sourcePrimitiveNodeName]
                                : [],
                        ),
                    ),
                ].toSorted((left, right) => left.localeCompare(right)),
                status: 'ready',
                target: {
                    x: ((targetPoint.x + 1) / 2) * size.width,
                    y: ((1 - targetPoint.y) / 2) * size.height,
                },
                transparentDrawCount: transparentPass?.children.length ?? 0,
                unresolvedBatchCount: asset
                    ? Number(asset.userData.unresolvedBatchCount ?? 0)
                    : fallbackMeshes.length,
            });
        };
        frame = window.requestAnimationFrame(inspect);
        return () => window.cancelAnimationFrame(frame);
    }, [camera, mode, onReady, scene, size.height, size.width]);

    return null;
}

export function GardenStructureKitV1RendererFixture({
    mode = 'production',
}: Readonly<{ mode?: GardenStructureKitV1RendererFixtureMode }>) {
    const [readback, setReadback] = useState<
        RendererReadback | Readonly<{ status: 'waiting' }>
    >({ status: 'waiting' });
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
        null,
    );
    const [selectedStructureId, setSelectedStructureId] = useState<
        string | null
    >(null);
    const [rendererReady, setRendererReady] = useState(false);
    const plan = useMemo(
        () => (mode === 'empty' ? null : fixturePlan(mode)),
        [mode],
    );
    const handleReady = useCallback(
        (nextReadback: RendererReadback) => setReadback(nextReadback),
        [],
    );
    const handleRendererReady = useCallback(() => setRendererReady(true), []);

    return (
        <div
            data-render-ready={
                mode === 'empty' || readback.status === 'ready'
                    ? 'true'
                    : 'false'
            }
            data-renderer-ready={rendererReady ? 'true' : 'false'}
            data-testid="garden-structure-kit-v1-renderer-fixture"
            style={{ height: 320, position: 'relative', width: 480 }}
        >
            <output
                data-testid="garden-structure-kit-v1-renderer-result"
                style={{ display: 'none' }}
            >
                {JSON.stringify(readback)}
            </output>
            <output
                data-testid="garden-structure-kit-v1-selection"
                style={{ display: 'none' }}
            >
                {selectedInstanceId ?? ''}
            </output>
            <output
                data-testid="garden-structure-kit-v1-selection-structure"
                style={{ display: 'none' }}
            >
                {selectedStructureId ?? ''}
            </output>
            <FixtureGameStateProvider>
                <Canvas
                    orthographic
                    camera={{ position: [4, 3.4, 5], zoom: 92 }}
                    frameloop="always"
                    gl={{ preserveDrawingBuffer: true }}
                >
                    <color args={['#dbe9cf']} attach="background" />
                    <ambientLight intensity={1.7} />
                    <directionalLight intensity={2.2} position={[3, 6, 4]} />
                    <CameraTarget />
                    {plan ? (
                        <GardenStructureCollectionRenderer
                            onRendererReady={handleRendererReady}
                            onSelect={({ instanceId, structureId }) => {
                                setSelectedInstanceId(instanceId);
                                setSelectedStructureId(structureId);
                            }}
                            plan={plan}
                            renderProps={
                                mode !== 'incompatible-portal-prop' &&
                                mode !== 'prop-only-hidden-mixed'
                            }
                            selectedInstanceId={selectedInstanceId}
                        />
                    ) : null}
                    {mode === 'empty' ? null : (
                        <RendererProbe mode={mode} onReady={handleReady} />
                    )}
                </Canvas>
            </FixtureGameStateProvider>
        </div>
    );
}
