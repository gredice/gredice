import { useFrame, useThree } from '@react-three/fiber';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { useRef, useState } from 'react';
import { Box3, Mesh, Vector3 } from 'three';
import { KestenijadaViewer } from '../src/kestenijada/KestenijadaViewer';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

function KestenijadaProbe({ onReady }: { onReady: (value: string) => void }) {
    const { scene, camera, size, gl } = useThree();
    const done = useRef(false);
    const frames = useRef(0);
    useSceneTimeInvalidation('test:kestenijada', !done.current);
    useFrame(() => {
        if (done.current || ++frames.current < 10) return;
        scene.updateMatrixWorld(true);
        const roots = [
            'ChestnutRoastingCart',
            'GardenTeaTable',
            'AutumnBlanketBench',
            'HarvestCrate',
        ];
        const objects = roots.map((name) =>
            scene.getObjectByName(
                `${name}:kestenijada-${name === 'HarvestCrate' ? 'HarvestCrateOrchard' : name}`,
            ),
        );
        const lantern = scene.getObjectByName(
            'WoodenHandLantern_Frame',
        )?.parent;
        if (objects.some((object) => !object) || !lantern) return;
        const geometry = [...objects, lantern].flatMap((object) => {
            if (!object) return [];
            let meshes = 0;
            object.traverse((child) => {
                if (child instanceof Mesh) meshes++;
            });
            const box = new Box3().setFromObject(object);
            const points = [];
            for (const x of [box.min.x, box.max.x])
                for (const y of [box.min.y, box.max.y])
                    for (const z of [box.min.z, box.max.z])
                        points.push(new Vector3(x, y, z).project(camera));
            return [
                {
                    name: object.name,
                    meshes,
                    min: box.min.toArray(),
                    max: box.max.toArray(),
                    screen: {
                        minX: Math.min(
                            ...points.map((p) => ((p.x + 1) * size.width) / 2),
                        ),
                        maxX: Math.max(
                            ...points.map((p) => ((p.x + 1) * size.width) / 2),
                        ),
                        minY: Math.min(
                            ...points.map((p) => ((1 - p.y) * size.height) / 2),
                        ),
                        maxY: Math.max(
                            ...points.map((p) => ((1 - p.y) * size.height) / 2),
                        ),
                    },
                },
            ];
        });
        if (geometry.some((item) => item.meshes === 0)) return;
        done.current = true;
        onReady(
            JSON.stringify({
                geometry,
                renderer: {
                    calls: gl.info.render.calls,
                    triangles: gl.info.render.triangles,
                },
                width: size.width,
                height: size.height,
            }),
        );
    });
    return null;
}
export function KestenijadaFixture({ active = false }: { active?: boolean }) {
    const [ready, setReady] = useState('');
    return (
        <div data-testid="kestenijada-fixture" data-ready={ready}>
            <NuqsAdapter>
                <KestenijadaViewer
                    referenceInstant="2026-10-03T12:00:00Z"
                    eventWindow={
                        active
                            ? {
                                  startsAt: '2026-10-03T11:00:00Z',
                                  endsAt: '2026-10-03T13:00:00Z',
                              }
                            : null
                    }
                    appBaseUrl={window.location.origin}
                    sceneChildren={<KestenijadaProbe onReady={setReady} />}
                />
            </NuqsAdapter>
        </div>
    );
}
