import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InstancedMesh, Object3D, Vector3 } from 'three';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    distantBirdFramingOpacity,
    type resolveDistantBirdFlockBounds,
    sampleDistantBirdFlockWindow,
    sampleDistantBirdPosition,
} from './distantBirdFlock';
import { createDistantBirdGeometry } from './distantBirdGeometry';
import {
    useSceneDeadline,
    useSceneElapsedTimeReader,
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
} from './SceneTime';

export function DistantBirdFlockMesh({
    count,
    seed,
    bounds,
}: {
    count: number;
    seed: string;
    bounds: ReturnType<typeof resolveDistantBirdFlockBounds>;
}) {
    const gltf = useGameGLTF('BirdSmall');
    const resources = useMemo(
        () => createDistantBirdGeometry(gltf.scene),
        [gltf.scene],
    );
    const mesh = useMemo(() => {
        const mesh = new InstancedMesh(
            resources.geometry,
            resources.material,
            5,
        );
        mesh.name = 'Environment:DistantBirdFlocks';
        mesh.count = 0;
        mesh.frustumCulled = false; // Each instance is projected and faded before the camera edges.
        mesh.raycast = () => {};
        return mesh;
    }, [resources]);
    const readTime = useSceneElapsedTimeReader();
    const fixed = useSceneFixedTimeSeconds();
    const visible = useSceneRuntimeVisible();
    const requestRender = useSceneRenderRequest();
    const [active, setActive] = useState(false);
    const [deadline, setDeadline] = useState<number | null>(null);
    const admission = useRef({ seed: '', slot: -1, count: 0, startedAt: 0 });
    const arrivalPending = useRef(true);
    const arrivalIdentity = useRef('');
    const object = useMemo(() => new Object3D(), []);
    const projected = useMemo(() => new Vector3(), []);
    useSceneTimeInvalidation(
        'distant-bird-flocks',
        visible && active && fixed === undefined,
    );
    useSceneDeadline({
        owner: 'distant-bird-flocks',
        deadlineMs: deadline,
        enabled: visible && !active && fixed === undefined,
        callback: () => {
            setDeadline(null);
            requestRender('distant-bird-flocks-due');
        },
    });
    useEffect(() => {
        const identity = `${seed}:${bounds.centerX}:${bounds.backZ}:${bounds.span}`;
        if (!visible || arrivalIdentity.current !== identity)
            arrivalPending.current = true;
        arrivalIdentity.current = identity;
        const seconds = readTime();
        const window = sampleDistantBirdFlockWindow(seed, seconds);
        setDeadline(
            visible && fixed === undefined && !window.active
                ? performance.now() + (window.nextStart - seconds) * 1000
                : null,
        );
        mesh.userData.capacity = count;
        mesh.userData.backZ = bounds.backZ;
        if (visible) requestRender('distant-bird-flocks-input');
    }, [visible, count, seed, bounds, fixed, readTime, mesh, requestRender]);
    useEffect(
        () => () => {
            mesh.dispose();
            resources.geometry.dispose();
            resources.material.dispose();
        },
        [mesh, resources],
    );
    useFrame(({ camera }) => {
        if (!visible) return;
        const seconds = readTime();
        const window = sampleDistantBirdFlockWindow(seed, seconds);
        mesh.userData.semanticSeconds = seconds;
        mesh.userData.nextStart = window.nextStart;
        mesh.userData.seed = seed;
        if (arrivalPending.current) {
            arrivalPending.current = false;
            admission.current.startedAt = seconds;
        }
        if (active !== window.active) setActive(window.active);
        if (!window.active) {
            mesh.count = 0;
            if (fixed === undefined && deadline === null) {
                setDeadline(
                    performance.now() + (window.nextStart - seconds) * 1000,
                );
            }
            return;
        }
        if (
            admission.current.slot !== window.slot ||
            admission.current.seed !== seed
        ) {
            admission.current = {
                seed,
                slot: window.slot,
                count,
                startedAt: seconds,
            };
        }
        // Live upgrades wait for the next crossing; frozen captures are history-independent.
        admission.current.count =
            fixed === undefined
                ? Math.min(count, admission.current.count)
                : count;
        const admitted = admission.current.count;
        let framingOpacity = 1;
        for (let index = 0; index < admitted; index++) {
            const position = sampleDistantBirdPosition(window, bounds, index);
            object.position.set(position.x, position.y, position.z);
            object.rotation.set(
                0,
                (window.direction * Math.PI) / 2,
                position.roll,
            );
            object.scale.setScalar(0.32);
            object.updateMatrix();
            mesh.setMatrixAt(index, object.matrix);
            projected.copy(object.position).project(camera);
            framingOpacity = Math.min(
                framingOpacity,
                distantBirdFramingOpacity(
                    projected.x,
                    projected.y,
                    projected.z,
                ),
            );
        }
        const arrivalOpacity =
            fixed === undefined
                ? Math.min(1, (seconds - admission.current.startedAt) / 2)
                : 1;
        resources.material.opacity =
            window.opacity * framingOpacity * arrivalOpacity;
        mesh.count = resources.material.opacity > 0 ? admitted : 0;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.slot = window.slot;
        mesh.userData.opacity = resources.material.opacity;
    });
    return <primitive object={mesh} dispose={null} />;
}
