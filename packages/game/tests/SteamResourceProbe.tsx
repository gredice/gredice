import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { InstancedMesh, ShaderMaterial } from 'three';

export function SteamResourceProbe({ onDispose }: { onDispose: () => void }) {
    const observed = useRef(new Set<InstancedMesh>());
    const cleanup = useRef<(() => void)[]>([]);
    useFrame(({ scene }) => {
        const mesh = scene.getObjectByName('Weather:LocalizedSteam');
        if (
            !(mesh instanceof InstancedMesh) ||
            !(mesh.material instanceof ShaderMaterial) ||
            observed.current.has(mesh)
        )
            return;
        observed.current.add(mesh);
        const material = mesh.material;
        const geometry = mesh.geometry;
        geometry.addEventListener('dispose', onDispose);
        material.addEventListener('dispose', onDispose);
        mesh.addEventListener('dispose', onDispose);
        cleanup.current.push(() => {
            geometry.removeEventListener('dispose', onDispose);
            material.removeEventListener('dispose', onDispose);
            mesh.removeEventListener('dispose', onDispose);
        });
    });
    useEffect(
        () => () => {
            for (const remove of cleanup.current) remove();
        },
        [],
    );
    return null;
}
