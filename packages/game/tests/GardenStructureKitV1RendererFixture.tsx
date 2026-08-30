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
    | 'missing'
    | 'production';

type RendererReadback = Readonly<{
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

function fixturePlan(
    mode: Exclude<GardenStructureKitV1RendererFixtureMode, 'empty'>,
): GardenStructureCollectionPlan {
    const useProductionBatches =
        mode === 'asset-error' || mode === 'production';
    return Object.freeze({
        ...sourceCollectionPlan,
        batches: Object.freeze({
            opaque: Object.freeze([]),
            props: Object.freeze(
                useProductionBatches ? [tableBatch] : [missingBatch],
            ),
            roof: Object.freeze([]),
            transparent: Object.freeze(
                useProductionBatches ? [greenhouseWallBatch] : [],
            ),
        }),
        cacheKey: `fixture:${mode}`,
        id: `fixture:${mode}`,
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
            const inspectedRoot = asset ?? fullFallback;
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
                            onSelect={({ instanceId }) =>
                                setSelectedInstanceId(instanceId)
                            }
                            plan={plan}
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
