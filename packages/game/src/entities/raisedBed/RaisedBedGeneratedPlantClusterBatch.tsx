'use client';

import { useEffect, useMemo } from 'react';
import { getGeneratedPlantInstanceVariation } from '../../generators/plant/lib/generatedPlantTemplates';
import type { PlantDefinition } from '../../generators/plant/lib/plant-definitions';
import type { PlantLodLevel } from '../../generators/plant/lib/plantLod';
import { buildApproximatePlantLodSummary } from '../../generators/plant/lib/plantLodSummary';
import { getPlantBillboardPrimitiveTriangleCount } from '../../generators/plant/lib/plantMidBillboardMaterial';
import {
    PlantBillboardBatch,
    type PlantBillboardBatchItem,
} from '../../generators/plant/parts/PlantBillboard';
import {
    getGeneratedPlantProfileSessionId,
    recordGeneratedPlantProfileBatch,
    removeGeneratedPlantProfileBatch,
} from '../../scene/generatedPlantProfileMetrics';
import { registerGeneratedPlantRenderBatch } from '../../scene/generatedPlantRenderRegistry';
import type { RaisedBedGeneratedPlantBatchInstance } from './RaisedBedGeneratedPlantBatch';

export interface RaisedBedGeneratedPlantClusterField {
    definition: PlantDefinition;
    fieldKey: string;
    instances: RaisedBedGeneratedPlantBatchInstance[];
}

export function RaisedBedGeneratedPlantClusterBatch({
    batchKey,
    fields,
    lodLevel,
}: {
    batchKey: string;
    fields: RaisedBedGeneratedPlantClusterField[];
    lodLevel: Exclude<PlantLodLevel, 'near'>;
}) {
    const billboards = useMemo<PlantBillboardBatchItem[]>(
        () =>
            fields.flatMap((field) =>
                field.instances.map((instance) => {
                    const variation = getGeneratedPlantInstanceVariation(
                        instance.seed,
                    );
                    return {
                        position: instance.position,
                        scale:
                            instance.scale * (variation.scaleMultiplier ?? 1),
                        summary: buildApproximatePlantLodSummary({
                            flowerGrowth: 1,
                            fruitGrowth: 1,
                            generation: instance.generation,
                            plantDefinition: field.definition,
                            seed: instance.seed,
                            showProduce: true,
                        }),
                    };
                }),
            ),
        [fields],
    );
    const clusterPrimitiveTriangleCount = useMemo(
        () =>
            getPlantBillboardPrimitiveTriangleCount(
                lodLevel,
                billboards.map((billboard) => billboard.summary),
            ),
        [billboards, lodLevel],
    );

    useEffect(
        () =>
            registerGeneratedPlantRenderBatch(batchKey, {
                clusterInstanceCount: billboards.length,
                clusterPrimitiveTriangleCount,
                detailedInstanceCount: 0,
                detailedLeafTriangleCount: 0,
                nearInstanceCount: 0,
                pendingDetailInstanceCount: 0,
            }),
        [batchKey, billboards.length, clusterPrimitiveTriangleCount],
    );

    useEffect(() => {
        const sessionId = getGeneratedPlantProfileSessionId();
        if (sessionId === null || fields.length === 0) {
            return;
        }

        recordGeneratedPlantProfileBatch(
            batchKey,
            {
                activeArchetypeCount: 0,
                failedArchetypeCount: 0,
                fields: fields.map((field) => ({
                    billboardInstanceCount: field.instances.length,
                    fieldKey: field.fieldKey,
                    instanceCount: field.instances.length,
                    raisedBedId: field.instances[0]?.raisedBedId ?? 0,
                    resolvedInstanceCount: 0,
                })),
                status: 'billboard',
            },
            sessionId,
        );

        return () => removeGeneratedPlantProfileBatch(batchKey, sessionId);
    }, [batchKey, fields]);

    return (
        <PlantBillboardBatch
            billboards={billboards}
            debugName={`RaisedBedPlantClusters:${batchKey}`}
            level={lodLevel}
        />
    );
}
