'use client';

import { updateGameProfileMetadata } from './gameProfileMetadata';

export type GeneratedPlantRenderBatchSnapshot = {
    clusterInstanceCount: number;
    clusterPrimitiveTriangleCount: number;
    detailedInstanceCount: number;
    detailedLeafTriangleCount: number;
    nearInstanceCount: number;
    pendingDetailInstanceCount: number;
};

type GeneratedPlantRenderBatchRegistration = {
    snapshot: GeneratedPlantRenderBatchSnapshot;
    token: symbol;
};

const registrations = new Map<string, GeneratedPlantRenderBatchRegistration>();

export function getGeneratedPlantRenderRegistrySnapshot() {
    let clusterInstanceCount = 0;
    let clusterPrimitiveTriangleCount = 0;
    let detailedInstanceCount = 0;
    let detailedLeafTriangleCount = 0;
    let nearInstanceCount = 0;
    let pendingDetailInstanceCount = 0;

    for (const registration of registrations.values()) {
        clusterInstanceCount += registration.snapshot.clusterInstanceCount;
        clusterPrimitiveTriangleCount +=
            registration.snapshot.clusterPrimitiveTriangleCount;
        detailedInstanceCount += registration.snapshot.detailedInstanceCount;
        detailedLeafTriangleCount +=
            registration.snapshot.detailedLeafTriangleCount;
        nearInstanceCount += registration.snapshot.nearInstanceCount;
        pendingDetailInstanceCount +=
            registration.snapshot.pendingDetailInstanceCount;
    }

    return {
        clusterInstanceCount,
        clusterPrimitiveTriangleCount,
        detailedInstanceCount,
        detailedLeafTriangleCount,
        nearInstanceCount,
        pendingDetailInstanceCount,
        renderBatchCount: registrations.size,
    };
}

function publishGeneratedPlantRenderSnapshot() {
    const snapshot = getGeneratedPlantRenderRegistrySnapshot();
    updateGameProfileMetadata({
        generatedPlantClusterInstanceCount: snapshot.clusterInstanceCount,
        generatedPlantClusterPrimitiveTriangleCount:
            snapshot.clusterPrimitiveTriangleCount,
        generatedPlantDetailedInstanceCount: snapshot.detailedInstanceCount,
        generatedPlantDetailedLeafTriangleCount:
            snapshot.detailedLeafTriangleCount,
        generatedPlantPendingDetailInstanceCount:
            snapshot.pendingDetailInstanceCount,
        generatedPlantRenderBatchCount: snapshot.renderBatchCount,
        generatedPlantRenderNearInstanceCount: snapshot.nearInstanceCount,
    });
}

export function registerGeneratedPlantRenderBatch(
    batchKey: string,
    snapshot: GeneratedPlantRenderBatchSnapshot,
) {
    const token = Symbol(batchKey);
    registrations.set(batchKey, { snapshot, token });
    publishGeneratedPlantRenderSnapshot();

    return () => {
        if (registrations.get(batchKey)?.token !== token) {
            return;
        }
        registrations.delete(batchKey);
        publishGeneratedPlantRenderSnapshot();
    };
}

export function resetGeneratedPlantRenderRegistryForTests() {
    registrations.clear();
}
