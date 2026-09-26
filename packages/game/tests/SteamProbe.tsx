import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { InstancedMesh, Matrix4, ShaderMaterial, Vector3 } from 'three';
import { useSteamSources } from '../src/scene/SteamSources';

export function SteamProbe({
    onSample,
}: {
    onSample: (value: string) => void;
}) {
    const { sources } = useSteamSources();
    const previous = useRef('');
    useFrame(({ scene }) => {
        const mesh = scene.getObjectByName('Weather:LocalizedSteam');
        if (
            !(mesh instanceof InstancedMesh) ||
            !(mesh.material instanceof ShaderMaterial)
        )
            return;
        const matrix = new Matrix4();
        const particles = Array.from({ length: mesh.count }, (_, index) => {
            mesh.getMatrixAt(index, matrix);
            return new Vector3().setFromMatrixPosition(matrix).toArray();
        });
        const sample = JSON.stringify({
            count: mesh.count,
            anchors: sources.map(({ object }) =>
                object.getWorldPosition(new Vector3()).toArray(),
            ),
            particles,
            depthTest: mesh.material.depthTest,
            depthWrite: mesh.material.depthWrite,
            castShadow: mesh.castShadow,
        });
        if (previous.current !== sample) {
            previous.current = sample;
            onSample(sample);
        }
    });
    return null;
}
