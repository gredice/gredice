'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Box3, Frustum, Matrix4 } from 'three';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import { GardenStructureCollectionRenderer } from './GardenStructureCollectionRenderer';
import type { GardenStructureSceneSnapshot } from './gardenStructureScene';
import {
    areGardenStructureIdSetsEqual,
    getGardenStructureBaselineVisiblePropInstanceIds,
    getGardenStructureFrustumVisibleIds,
    getGardenStructureSceneSubmissionMetrics,
} from './gardenStructureSceneVisibility';

const emptyVisibleInteriorStructureIds: ReadonlySet<string> = new Set();
const emptyVisiblePropInstanceIds: ReadonlySet<string> = new Set();

export type GardenStructureSceneLayerProps = Readonly<{
    castShadows?: boolean;
    hiddenInstanceIds?: ReadonlySet<string>;
    onRendererReady?: () => void;
    profileMetricsEnabled?: boolean;
    renderProps?: boolean;
    snapshot: GardenStructureSceneSnapshot;
    /** Structures whose interior props are explicitly admitted by avatar state. */
    visibleInteriorStructureIds?: ReadonlySet<string>;
}>;

function GardenStructureVisibleSceneCollection({
    castShadows,
    hiddenInstanceIds,
    onRendererReady,
    plan,
    profileMetricsEnabled,
    renderProps,
    visibleInteriorStructureIds,
}: Readonly<{
    castShadows: boolean;
    hiddenInstanceIds?: ReadonlySet<string>;
    onRendererReady?: () => void;
    plan: NonNullable<GardenStructureSceneSnapshot['plan']>;
    profileMetricsEnabled: boolean;
    renderProps: boolean;
    visibleInteriorStructureIds: ReadonlySet<string>;
}>) {
    const camera = useThree((state) => state.camera);
    const boundsBox = useMemo(() => new Box3(), []);
    const cameraFrustum = useMemo(() => new Frustum(), []);
    const projectionViewMatrix = useMemo(() => new Matrix4(), []);
    const lastProjectionViewMatrix = useRef(new Matrix4());
    const [visibilityReady, setVisibilityReady] = useState(false);
    const visibilityReadyRef = useRef(false);
    const [visibleStructureIds, setVisibleStructureIds] = useState<
        ReadonlySet<string>
    >(() => new Set());
    const visibleStructureIdsRef = useRef(visibleStructureIds);
    const updateVisibleStructureIds = useCallback(
        (force = false) => {
            camera.updateMatrixWorld();
            projectionViewMatrix.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse,
            );
            if (
                !force &&
                projectionViewMatrix.equals(lastProjectionViewMatrix.current)
            ) {
                return;
            }
            lastProjectionViewMatrix.current.copy(projectionViewMatrix);
            cameraFrustum.setFromProjectionMatrix(projectionViewMatrix);
            const nextVisibleStructureIds = getGardenStructureFrustumVisibleIds(
                plan,
                cameraFrustum,
                boundsBox,
            );
            if (
                !areGardenStructureIdSetsEqual(
                    visibleStructureIdsRef.current,
                    nextVisibleStructureIds,
                )
            ) {
                visibleStructureIdsRef.current = nextVisibleStructureIds;
                setVisibleStructureIds(nextVisibleStructureIds);
            }
            if (!visibilityReadyRef.current) {
                visibilityReadyRef.current = true;
                setVisibilityReady(true);
            }
        },
        [boundsBox, camera, cameraFrustum, plan, projectionViewMatrix],
    );

    useLayoutEffect(
        () => updateVisibleStructureIds(true),
        [updateVisibleStructureIds],
    );
    useFrame(() => updateVisibleStructureIds());

    const baselineVisiblePropInstanceIds = useMemo(
        () =>
            renderProps
                ? getGardenStructureBaselineVisiblePropInstanceIds(plan)
                : emptyVisiblePropInstanceIds,
        [plan, renderProps],
    );
    const submissionMetrics = useMemo(
        () =>
            profileMetricsEnabled
                ? getGardenStructureSceneSubmissionMetrics({
                      plan,
                      baselineVisiblePropInstanceIds,
                      renderProps,
                      visibleInteriorStructureIds,
                      visibleStructureIds,
                  })
                : undefined,
        [
            baselineVisiblePropInstanceIds,
            plan,
            profileMetricsEnabled,
            renderProps,
            visibleInteriorStructureIds,
            visibleStructureIds,
        ],
    );
    useEffect(() => {
        if (!profileMetricsEnabled || !visibilityReady || !submissionMetrics) {
            return;
        }
        updateGameProfileMetadata({
            gardenStructureCollectionDetailSuppressedPropCount:
                submissionMetrics.detailSuppressedPropCount,
            gardenStructureCollectionExteriorSuppressedPropCount:
                submissionMetrics.exteriorSuppressedPropCount,
            gardenStructureCollectionFrustumCulledPropCount:
                submissionMetrics.frustumCulledPropCount,
            gardenStructureCollectionFrustumCulledStructureCount:
                submissionMetrics.frustumCulledStructureCount,
            gardenStructureCollectionPropCount: submissionMetrics.propCount,
            gardenStructureCollectionStructureCount: plan.structures.length,
            gardenStructureCollectionVisiblePropCount:
                submissionMetrics.visiblePropCount,
            gardenStructureCollectionVisibleStructureCount:
                submissionMetrics.visibleStructureCount,
        });
        return () =>
            updateGameProfileMetadata({
                gardenStructureCollectionDetailSuppressedPropCount: 0,
                gardenStructureCollectionExteriorSuppressedPropCount: 0,
                gardenStructureCollectionFrustumCulledPropCount: 0,
                gardenStructureCollectionFrustumCulledStructureCount: 0,
                gardenStructureCollectionPropCount: 0,
                gardenStructureCollectionStructureCount: 0,
                gardenStructureCollectionVisiblePropCount: 0,
                gardenStructureCollectionVisibleStructureCount: 0,
            });
    }, [
        plan.structures.length,
        profileMetricsEnabled,
        submissionMetrics,
        visibilityReady,
    ]);
    useEffect(() => {
        if (visibilityReady && visibleStructureIds.size === 0) {
            onRendererReady?.();
        }
    }, [onRendererReady, visibilityReady, visibleStructureIds.size]);

    if (!visibilityReady || visibleStructureIds.size === 0) {
        return null;
    }

    return (
        <GardenStructureCollectionRenderer
            castShadows={castShadows}
            hiddenInstanceIds={hiddenInstanceIds}
            onRendererReady={onRendererReady}
            plan={plan}
            profileMetricsEnabled={profileMetricsEnabled}
            renderProps={renderProps}
            admittedPropStructureIds={visibleInteriorStructureIds}
            baselineVisiblePropInstanceIds={baselineVisiblePropInstanceIds}
            visibleStructureIds={visibleStructureIds}
        />
    );
}

/** Renders a validated saved-scene snapshot inside the existing R3F scene. */
export function GardenStructureSceneLayer({
    castShadows = true,
    hiddenInstanceIds,
    onRendererReady,
    profileMetricsEnabled = false,
    renderProps = true,
    snapshot,
    visibleInteriorStructureIds = emptyVisibleInteriorStructureIds,
}: GardenStructureSceneLayerProps) {
    const plan = snapshot.plan;

    if (!plan || plan.structures.length === 0) {
        return null;
    }

    return (
        <group
            name="GardenStructures:SavedSceneLayer"
            userData={{
                diagnosticIssueCodes:
                    snapshot.diagnostics.sampledIssueCodes.join(','),
                diagnosticStatus: snapshot.diagnostics.status,
                rejectedRecordCount: snapshot.diagnostics.rejectedRecordCount,
                structureCount: plan.structures.length,
                warningCount: snapshot.diagnostics.warningCount,
            }}
        >
            <GardenStructureVisibleSceneCollection
                castShadows={castShadows}
                hiddenInstanceIds={hiddenInstanceIds}
                key={plan.cacheKey}
                onRendererReady={onRendererReady}
                plan={plan}
                profileMetricsEnabled={profileMetricsEnabled}
                renderProps={renderProps}
                visibleInteriorStructureIds={visibleInteriorStructureIds}
            />
        </group>
    );
}
