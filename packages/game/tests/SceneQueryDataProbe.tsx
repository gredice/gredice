import { useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useLayoutEffect, useMemo } from 'react';
import { Mesh, Vector3 } from 'three';

export function SceneQueryDataProbe({
    output,
}: {
    output: RefObject<HTMLOutputElement | null>;
}) {
    const { scene, gl, camera } = useThree();
    const position = useMemo(() => new Vector3(), []);
    useLayoutEffect(() => {
        camera.lookAt(0, 3, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        const meshes: { name: string; uuid: string; position: number[] }[] = [];
        const leaves: {
            name: string;
            uuid: string;
            dataState: unknown;
            instanceHeights: unknown;
        }[] = [];
        scene.traverse((object) => {
            if (
                object.name.startsWith('scene-query-bucket-') &&
                object instanceof Mesh
            ) {
                object.getWorldPosition(position);
                meshes.push({
                    name: object.name,
                    uuid: object.uuid,
                    position: position.toArray(),
                });
            }
            if (object.userData.fixtureKind === 'scene-query-leaf') {
                leaves.push({
                    name: object.name,
                    uuid: object.uuid,
                    dataState: object.userData.dataState,
                    instanceHeights: object.userData.instanceHeights,
                });
            }
        });
        output.current?.setAttribute(
            'data-sample',
            JSON.stringify({
                meshes,
                leaves,
                renderedCalls: gl.info.render.calls,
                fallback: Boolean(
                    scene.getObjectByName('scene-query-fallback'),
                ),
            }),
        );
    });
    return null;
}
