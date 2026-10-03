import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    OrthographicCamera,
    Raycaster,
    Vector2,
    Vector3,
} from 'three';
import { useSceneRenderRequest } from '../src/scene/SceneTime';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
export function DistantBirdFlockProbe({
    onSample,
    onDispose,
    revision,
    zoom,
}: {
    onSample: (sample: string) => void;
    onDispose: () => void;
    revision: string;
    zoom: number;
}) {
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    const request = useSceneRenderRequest();
    const observed = useRef(new Set<InstancedMesh>());
    const cleanup = useRef<(() => void)[]>([]);
    const latest = useRef<Record<string, unknown>>({});
    const previous = useRef('');
    useEffect(() => {
        if (camera instanceof OrthographicCamera) {
            camera.zoom = zoom;
            camera.updateProjectionMatrix();
        }
        request(`test:distant-bird-input:${revision}`);
    }, [camera, zoom, request, revision]);
    useSceneAfterFrame(() => {
        const mesh = scene.getObjectByName('Environment:DistantBirdFlocks');
        if (
            !(mesh instanceof InstancedMesh) ||
            !(mesh.material instanceof MeshStandardMaterial)
        ) {
            latest.current = {
                count: 0,
                exists: false,
                calls: gl.info.render.calls,
            };
        } else {
            if (!observed.current.has(mesh)) {
                observed.current.add(mesh);
                mesh.addEventListener('dispose', onDispose);
                mesh.geometry.addEventListener('dispose', onDispose);
                mesh.material.addEventListener('dispose', onDispose);
                const material = mesh.material;
                cleanup.current.push(() => {
                    mesh.removeEventListener('dispose', onDispose);
                    mesh.geometry.removeEventListener('dispose', onDispose);
                    material.removeEventListener('dispose', onDispose);
                });
            }
            const matrix = new Matrix4();
            const positions = Array.from({ length: mesh.count }, (_, index) => {
                mesh.getMatrixAt(index, matrix);
                return new Vector3().setFromMatrixPosition(matrix).toArray();
            });
            const center = new Vector3(...(positions[0] ?? [0, 6, 8])).project(
                camera,
            );
            const ray = new Raycaster();
            ray.setFromCamera(new Vector2(center.x, center.y), camera);
            latest.current = {
                exists: true,
                count: mesh.count,
                positions,
                opacity: mesh.material.opacity,
                slot: mesh.userData.slot,
                rayHits: ray.intersectObject(mesh, false).length,
                depthTest: mesh.material.depthTest,
                depthWrite: mesh.material.depthWrite,
                castShadow: mesh.castShadow,
                receiveShadow: mesh.receiveShadow,
                geometryTriangles:
                    mesh.geometry.getAttribute('position').count / 3,
                geometryId: mesh.geometry.uuid,
                semanticSeconds: mesh.userData.semanticSeconds,
                seed: mesh.userData.seed,
                nextStart: mesh.userData.nextStart,
            };
        }
        const sample = JSON.stringify({
            ...latest.current,
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
        });
        if (sample !== previous.current) {
            previous.current = sample;
            onSample(sample);
        }
    });
    useEffect(
        () => () => {
            for (const remove of cleanup.current) remove();
        },
        [],
    );
    return null;
}
