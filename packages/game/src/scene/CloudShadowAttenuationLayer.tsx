'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
    type CloudShadowMaterialLeaseMap,
    getCloudShadowAttenuationMaterialCandidateRevision,
    getCloudShadowAttenuationMaterialUniforms,
    releaseCloudShadowAttenuationMaterials,
    syncCloudShadowAttenuationMaterials,
} from './cloudShadowAttenuation';
import { updateGameProfileMetadata } from './gameProfileMetadata';

const materialScanMs = 1_000;

/**
 * Keeps every lit material in the scene patched with the cloud shadow
 * ellipses while `enabled`: new materials are picked up on a slow scan and
 * at once when they register as candidates. No render target and no mask:
 * the shadow is analytic, so this layer never draws anything itself. The
 * shadow driver writes the ellipse uniforms.
 */
export function CloudShadowAttenuation({
    active,
    enabled,
}: {
    /**
     * Whether a shadow shows (default: `enabled`). Materials stay patched
     * while `enabled`; the static cache takes its second, shadowed capture
     * only while `active`.
     */
    active?: boolean;
    enabled: boolean;
}) {
    const scene = useThree((state) => state.scene);
    const gl = useThree((state) => state.gl);
    const leasesRef = useRef<CloudShadowMaterialLeaseMap>(new Map());
    const nextMaterialScanAtRef = useRef(0);
    const materialCandidateRevisionRef = useRef(-1);
    const uniforms = getCloudShadowAttenuationMaterialUniforms();

    useLayoutEffect(() => {
        const leases = leasesRef.current;
        const materialCount = syncCloudShadowAttenuationMaterials({
            enabled,
            leases,
            root: scene,
            uniforms,
            renderer: gl,
        });
        updateGameProfileMetadata({
            cloudAttenuationMaterialCount: materialCount,
        });
        materialCandidateRevisionRef.current =
            getCloudShadowAttenuationMaterialCandidateRevision();

        return () => {
            uniforms.active.value = 0;
            uniforms.strength.value = 0;
            releaseCloudShadowAttenuationMaterials(leases);
            updateGameProfileMetadata({
                cloudAttenuationMaterialCount: 0,
            });
        };
    }, [enabled, gl, scene, uniforms]);
    const shadowsActive = enabled && (active ?? enabled);
    // Runs after the patch effect above (and again whenever it re-runs, as
    // its cleanup turns the flag off).
    // biome-ignore lint/correctness/useExhaustiveDependencies: gl and scene re-run the patch effect, whose cleanup clears the flag.
    useLayoutEffect(() => {
        uniforms.active.value = shadowsActive ? 1 : 0;
    }, [enabled, gl, scene, shadowsActive, uniforms]);

    useFrame(() => {
        if (!enabled) {
            return;
        }
        const now = performance.now();
        const revision = getCloudShadowAttenuationMaterialCandidateRevision();
        if (
            revision === materialCandidateRevisionRef.current &&
            now < nextMaterialScanAtRef.current
        ) {
            return;
        }
        materialCandidateRevisionRef.current = revision;
        nextMaterialScanAtRef.current = now + materialScanMs;
        const materialCount = syncCloudShadowAttenuationMaterials({
            enabled,
            leases: leasesRef.current,
            root: scene,
            uniforms,
            renderer: gl,
        });
        updateGameProfileMetadata({
            cloudAttenuationMaterialCount: materialCount,
        });
    });

    return null;
}
