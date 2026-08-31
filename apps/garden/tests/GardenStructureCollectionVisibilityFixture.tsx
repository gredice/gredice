'use client';

import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useMemo, useRef, useState } from 'react';
import { compileGardenStructurePlan } from '../../../packages/game/src/structures/compileGardenStructurePlan';
import { debugGardenStructureKitMetadata } from '../../../packages/game/src/structures/debugStructureKit';
import { GardenStructureCollectionRenderer } from '../../../packages/game/src/structures/GardenStructureCollectionRenderer';
import { createGardenStructureCollectionPlan } from '../../../packages/game/src/structures/gardenStructureCollectionPlan';

const houseDocument = createGardenStructureTemplateSeed('house').document;
const primary = compileGardenStructurePlan({
    baseHeight: 0.3,
    document: houseDocument,
    placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    revision: 1,
    structureId: 'visibility-primary',
});
const neighbor = compileGardenStructurePlan({
    baseHeight: 0.3,
    document: houseDocument,
    placement: { anchorX: 10, anchorY: 0, rotation: 0 },
    revision: 1,
    structureId: 'visibility-neighbor',
});
const plan = createGardenStructureCollectionPlan([
    { kit: debugGardenStructureKitMetadata, plan: primary },
    { kit: debugGardenStructureKitMetadata, plan: neighbor },
]);
function requiredFixtureValue<Value>(
    value: Value | null | undefined,
    message: string,
): Value {
    if (value === null || value === undefined) {
        throw new Error(message);
    }
    return value;
}

const hiddenRoofInstanceId = requiredFixtureValue(
    primary.batches.roof[0]?.instanceIds[0],
    'The visibility fixture requires a roof instance.',
);
const hiddenWallInstanceId = `edge:${primary.structureId}:window-north`;
const roofBatch = requiredFixtureValue(
    plan.batches.roof.find((batch) =>
        batch.instanceIds.includes(hiddenRoofInstanceId),
    ),
    'The visibility fixture requires a roof batch.',
);
const wallBatch = requiredFixtureValue(
    [...plan.batches.opaque, ...plan.batches.transparent].find((batch) =>
        batch.instanceIds.includes(hiddenWallInstanceId),
    ),
    'The visibility fixture requires a wall batch.',
);

type FallbackMeshSample = Readonly<{
    count: number;
    semanticFallback: boolean;
    visible: boolean;
}>;

function FallbackMeshProbe({
    batchId,
    onSample,
}: {
    batchId: string;
    onSample: (sample: FallbackMeshSample) => void;
}) {
    const scene = useThree((state) => state.scene);
    const previousKeyRef = useRef('');

    useFrame(() => {
        const object = scene.getObjectByName(
            `GardenStructureCollectionBatch:${batchId}`,
        );
        const count =
            object && 'count' in object && typeof object.count === 'number'
                ? object.count
                : -1;
        const sample = {
            count,
            semanticFallback: object?.userData.semanticFallback === true,
            visible: object?.visible === true,
        } satisfies FallbackMeshSample;
        const key = `${sample.count.toString()}|${sample.visible.toString()}|${sample.semanticFallback.toString()}`;
        if (key === previousKeyRef.current) {
            return;
        }
        previousKeyRef.current = key;
        onSample(sample);
    });

    return null;
}

const pendingSample = Object.freeze({
    count: -1,
    semanticFallback: false,
    visible: false,
}) satisfies FallbackMeshSample;

export function GardenStructureCollectionVisibilityFixture() {
    const [hidden, setHidden] = useState<'all' | 'cutaway' | 'none'>('none');
    const [roofSample, setRoofSample] =
        useState<FallbackMeshSample>(pendingSample);
    const [wallSample, setWallSample] =
        useState<FallbackMeshSample>(pendingSample);
    const hiddenInstanceIds = useMemo(() => {
        if (hidden === 'none') {
            return new Set<string>();
        }
        if (hidden === 'all') {
            return new Set([
                ...roofBatch.instanceIds,
                ...wallBatch.instanceIds,
            ]);
        }
        return new Set([hiddenRoofInstanceId, hiddenWallInstanceId]);
    }, [hidden]);
    const sampleRoof = useCallback((sample: FallbackMeshSample) => {
        setRoofSample(sample);
    }, []);
    const sampleWall = useCallback((sample: FallbackMeshSample) => {
        setWallSample(sample);
    }, []);

    return (
        <div data-testid="garden-structure-visibility-fixture">
            <button type="button" onClick={() => setHidden('cutaway')}>
                Hide cutaway instances
            </button>
            <button type="button" onClick={() => setHidden('all')}>
                Hide target batches
            </button>
            <button type="button" onClick={() => setHidden('none')}>
                Show all instances
            </button>
            <output
                data-hidden-mode={hidden}
                data-roof-batch-count={roofBatch.instanceIds.length}
                data-testid="garden-structure-visibility-result"
                data-wall-batch-count={wallBatch.instanceIds.length}
            >
                {JSON.stringify({ roof: roofSample, wall: wallSample })}
            </output>
            <div className="h-48 w-72">
                <Canvas camera={{ position: [5, 6, 8] }}>
                    <GardenStructureCollectionRenderer
                        hiddenInstanceIds={hiddenInstanceIds}
                        plan={plan}
                    />
                    <FallbackMeshProbe
                        batchId={roofBatch.id}
                        onSample={sampleRoof}
                    />
                    <FallbackMeshProbe
                        batchId={wallBatch.id}
                        onSample={sampleWall}
                    />
                </Canvas>
            </div>
        </div>
    );
}
