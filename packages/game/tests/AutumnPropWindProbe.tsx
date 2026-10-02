import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { type Material, Mesh, Raycaster, Vector3 } from 'three';
import { useAutumnPropWind } from '../src/scene/AutumnPropWindProvider';
import {
    useSceneAfterRenderSubscription,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';
import { useGameState } from '../src/useGameState';

export function AutumnPropWindProbe({
    onReady,
    present,
}: {
    onReady: (value: string) => void;
    present: boolean;
}) {
    const { scene, gl, camera, size } = useThree();
    const wind = useAutumnPropWind();
    const date = useGameState((state) =>
        state.freezeTime?.toISOString().slice(0, 10),
    );
    const visible = useSceneRuntimeVisible();
    const frames = useRef(0);
    const started = useRef(0);
    const timings = useRef<number[]>([]);
    const previousBound = useRef(-1);
    const afterRender = useSceneAfterRenderSubscription();
    useEffect(
        () =>
            afterRender(() => {
                if (
                    started.current &&
                    frames.current > 20 &&
                    timings.current.length < 40
                ) {
                    timings.current.push(performance.now() - started.current);
                }
            }),
        [afterRender],
    );
    const materials = useRef(new Set<Material>());
    const disposed = useRef(0);
    const last = useRef('');
    useSceneTimeInvalidation('test:prop-wind-ready', visible);
    useLayoutEffect(() => {
        camera.lookAt(-0.5, 0.65, -0.5);
        camera.updateProjectionMatrix();
    }, [camera]);
    useEffect(() => {
        frames.current = present ? 0 : 10;
    }, [present]);
    useEffect(() => {
        if (!visible) onReady(JSON.stringify({ hidden: true }));
    }, [visible, onReady]);
    useFrame(() => {
        if (++frames.current < 12) return;
        let bound = 0,
            overlays = 0,
            mismatched = 0;
        const roles = new Set<string>();
        const phases: Record<string, number> = {};
        scene.traverse((node) => {
            if (!(node instanceof Mesh)) return;
            for (const material of Array.isArray(node.material)
                ? node.material
                : [node.material]) {
                const binding = material.userData.autumnPropWind;
                if (!binding) continue;
                bound++;
                roles.add(binding.role);
                phases[binding.role] = binding.uniforms.uAutumnWindPhase.value;
                if (
                    node.name === 'SnowOverlay' ||
                    node.name === 'RainWetOverlay'
                )
                    overlays++;
                if (
                    binding.uniforms.uAutumnWindTime !== wind?.time ||
                    binding.uniforms.uAutumnWindStrength !== wind?.strength
                )
                    mismatched++;
                if (!materials.current.has(material)) {
                    materials.current.add(material);
                    material.addEventListener('dispose', () => {
                        disposed.current++;
                    });
                }
            }
        });
        const targets = [
            'AutumnGrass:prop:0',
            'AutumnGrass:prop:1',
            'AutumnEntrance:prop:2',
            'AutumnEntrance:prop:3',
            'GardenScarecrow:prop:4',
            'FenceGate:prop:5',
        ].map((name) => {
            const root = scene.getObjectByName(name);
            if (!root) return null;
            root.updateWorldMatrix(true, true);
            const target = root.localToWorld(
                new Vector3(
                    name === 'AutumnEntrance:prop:3' ? -0.34 : 0,
                    name.startsWith('GardenScarecrow') ? 0.9 : 0.2,
                    0,
                ),
            );
            const hits = new Raycaster(
                camera.position,
                target.clone().sub(camera.position).normalize(),
            ).intersectObject(root, true);
            const screen = target.project(camera);
            return {
                name,
                hits: hits.length,
                matrix: root.matrixWorld.elements,
                x: ((screen.x + 1) * size.width) / 2,
                y: ((1 - screen.y) * size.height) / 2,
            };
        });
        if (previousBound.current !== bound) {
            previousBound.current = bound;
            timings.current = [];
            frames.current = 12;
        }
        const sortedTimings = [...timings.current].sort((a, b) => a - b);
        const data = JSON.stringify({
            date,
            phases,
            renderSubmitSamples: sortedTimings.length,
            renderSubmitMedianMs:
                sortedTimings[Math.floor(sortedTimings.length / 2)] ?? 0,
            bound,
            overlays,
            mismatched,
            roles: [...roles].sort(),
            strength: wind?.strength.value,
            time: wind?.time.value,
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
            geometries: gl.info.memory.geometries,
            disposed: disposed.current,
            targets,
        });
        if (data !== last.current) {
            last.current = data;
            onReady(data);
        }
        started.current = performance.now();
    });
    return null;
}
