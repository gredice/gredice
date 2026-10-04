import { useFrame, useThree } from '@react-three/fiber';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
    Color,
    DoubleSide,
    type Group,
    InstancedMesh,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    RingGeometry,
    Vector3,
} from 'three';
import {
    currentAccountKeys,
    useCurrentAccount,
} from '../hooks/useCurrentAccount';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { createAutumnLeafGeometry } from '../scene/autumnLeafGeometry';
import { getAutumnLeafColor } from '../scene/autumnPalette';
import {
    useSceneDeadline,
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../scene/SceneTime';
import { useGameState, useGameStateStore } from '../useGameState';
import {
    getLeafRakingTargets,
    leafRakingAnchorName,
    leafRakingCooldownMs,
    leafRakingDurationMs,
    leafRakingParticleCount,
    sampleLeafRaking,
} from './leafRaking';

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(listener: () => void) {
    const query = window.matchMedia(motionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}

/** Only the main interactive scene owns this transient activity; public captures never mount it. */
export function CosmeticLeafRaking({ noSound = false }: { noSound?: boolean }) {
    const store = useGameStateStore();
    const queryClient = useQueryClient();
    const controller = useGameState((state) => state.cosmeticLeafRaking);
    const dragging = useGameState((state) =>
        Boolean(
            state.activeDragPreview ||
                state.pickupBlock ||
                state.hudPlacementDrag,
        ),
    );
    const authenticated = useGameState(
        (state) => state.authenticatedGardenQueriesEnabled,
    );
    const { data: account } = useCurrentAccount(authenticated);
    const { data: garden } = useCurrentGarden();
    const snapshot = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
    );
    const visible = useSceneRuntimeVisible();
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const scene = useThree((state) => state.scene);
    const clock = useThree((state) => state.clock);
    const requestRender = useSceneRenderRequest();
    const reducedMotion = useSyncExternalStore(
        subscribeMotion,
        () => window.matchMedia(motionQuery).matches,
        () => false,
    );
    const pendingSound = useRef<AbortController | null>(null);
    const group = useRef<Group>(null);
    const meshes = useMemo(() => {
        const leaves = new InstancedMesh(
            createAutumnLeafGeometry(),
            new MeshBasicMaterial({ side: DoubleSide }),
            leafRakingParticleCount,
        );
        leaves.name = 'CosmeticLeafRaking:Leaves';
        leaves.raycast = () => {};
        leaves.frustumCulled = false;
        leaves.count = 0;
        for (let index = 0; index < leafRakingParticleCount; index++)
            leaves.setColorAt(
                index,
                getAutumnLeafColor(
                    new Color('#d6b83f'),
                    0.6,
                    `rake-leaf-${index}`,
                ),
            );
        const sweep = new Mesh(
            new RingGeometry(0.32, 0.35, 16, 1, 0, Math.PI * 0.8),
            new MeshBasicMaterial({
                color: '#d78335',
                transparent: true,
                opacity: 0.5,
                side: DoubleSide,
                depthWrite: false,
            }),
        );
        sweep.name = 'CosmeticLeafRaking:Sweep';
        sweep.rotation.x = -Math.PI / 2;
        sweep.raycast = () => {};
        sweep.visible = false;
        return { leaves, sweep, dummy: new Object3D() };
    }, []);
    useEffect(
        () => () => {
            meshes.leaves.dispose();
            meshes.leaves.geometry.dispose();
            meshes.leaves.material.dispose();
            meshes.sweep.geometry.dispose();
            meshes.sweep.material.dispose();
        },
        [meshes],
    );
    useEffect(() => {
        if (!garden || !visible || dragging) return;
        const disconnect = controller.connect((targetId, sound) => {
            const state = store.getState();
            if (
                queryClient.getQueryData<{ id: string } | null>(
                    currentAccountKeys,
                )?.id !== account?.id
            )
                return false;
            if (
                state.activeDragPreview ||
                state.pickupBlock ||
                state.hudPlacementDrag ||
                !visible
            )
                return false;
            const target = getLeafRakingTargets(garden.stacks).find(
                (block) => block.id === targetId,
            );
            if (!target) return false;
            const anchor = scene.getObjectByName(
                leafRakingAnchorName(target.name, target.id),
            );
            if (!anchor) return false;
            for (
                let current: Object3D | null = anchor;
                current;
                current = current.parent
            ) {
                if (!current.visible) return false;
            }
            const origin = anchor.getWorldPosition(new Vector3());
            const started = controller.start({
                targetId,
                origin: [origin.x, origin.y, origin.z],
                startedAtMs: performance.now(),
                sceneTime: fixedTime ?? clock.getElapsedTime(),
                reducedMotion: reducedMotion || fixedTime !== undefined,
            });
            if (!started) return false;
            requestRender('cosmetic-leaf-raking-start');
            const audioState = state.audio.getState();
            if (
                sound &&
                !noSound &&
                !audioState.master.isMuted &&
                !audioState.ambient.isMuted &&
                audioState.master.volume > 0 &&
                audioState.ambient.volume > 0
            ) {
                pendingSound.current?.abort();
                pendingSound.current = new AbortController();
                void state.audio.playOneShot(
                    'ambient',
                    `${state.appBaseUrl}/assets/sounds/autumn-leaf-step-v1-1.wav`,
                    {
                        volume: 0.25,
                        queueWhenLocked: false,
                        maxDelayMs: 100,
                        signal: pendingSound.current.signal,
                        silentFailure: true,
                    },
                );
            }
            return true;
        });
        return () => {
            disconnect();
            pendingSound.current?.abort();
            pendingSound.current = null;
            requestRender('cosmetic-leaf-raking-reset');
        };
    }, [
        garden,
        account?.id,
        queryClient,
        visible,
        dragging,
        reducedMotion,
        fixedTime,
        noSound,
        controller,
        store,
        scene,
        clock,
        requestRender,
    ]);
    useEffect(
        () =>
            store.getState().audio.subscribe(() => {
                const audio = store.getState().audio.getState();
                if (
                    audio.master.isMuted ||
                    audio.ambient.isMuted ||
                    audio.isBackgrounded ||
                    audio.master.volume <= 0 ||
                    audio.ambient.volume <= 0
                )
                    pendingSound.current?.abort();
            }),
        [store],
    );
    const action = snapshot.action;
    const sweeping = action?.phase === 'sweeping';
    useSceneTimeInvalidation(
        'cosmetic-leaf-raking',
        Boolean(sweeping && !action?.reducedMotion && visible),
        30,
    );
    useSceneDeadline({
        owner: 'cosmetic-leaf-raking-lifetime',
        deadlineMs: action
            ? action.startedAtMs +
              (sweeping
                  ? action.reducedMotion
                      ? 180
                      : leafRakingDurationMs
                  : leafRakingCooldownMs)
            : null,
        callback: () => controller.advance(performance.now()),
    });
    useEffect(() => {
        if (!sweeping) pendingSound.current?.abort();
        meshes.leaves.count =
            sweeping && !action?.reducedMotion ? leafRakingParticleCount : 0;
        meshes.sweep.visible = Boolean(sweeping);
        requestRender('cosmetic-leaf-raking-phase');
    }, [sweeping, action?.reducedMotion, meshes, requestRender]);
    useFrame(() => {
        if (!action || !sweeping || !group.current) return;
        const progress = action.reducedMotion
            ? 0.5
            : Math.min(
                  1,
                  Math.max(
                      0,
                      (time.value - action.sceneTime) /
                          (leafRakingDurationMs / 1000),
                  ),
              );
        group.current.position.set(...action.origin);
        group.current.userData.startedAtMs = action.startedAtMs;
        group.current.userData.progress = progress;
        group.current.userData.leafCount = meshes.leaves.count;
        group.current.userData.reducedMotion = action.reducedMotion;
        meshes.sweep.rotation.z = sampleLeafRaking(progress, 0).sweepAngle;
        meshes.sweep.material.opacity = action.reducedMotion
            ? 0.3
            : 0.5 * Math.sin(Math.PI * progress);
        for (let index = 0; index < meshes.leaves.count; index++) {
            const pose = sampleLeafRaking(progress, index);
            meshes.dummy.position.set(pose.x, pose.y, pose.z);
            meshes.dummy.rotation.set(
                pose.rotation,
                pose.rotation * 0.3,
                pose.rotation,
            );
            meshes.dummy.scale.setScalar(pose.scale);
            meshes.dummy.updateMatrix();
            meshes.leaves.setMatrixAt(index, meshes.dummy.matrix);
        }
        meshes.leaves.instanceMatrix.needsUpdate = true;
    });
    return (
        <group
            ref={group}
            name="CosmeticLeafRaking:Effect"
            visible={Boolean(sweeping)}
            dispose={null}
        >
            <primitive object={meshes.leaves} />
            <primitive object={meshes.sweep} />
        </group>
    );
}
