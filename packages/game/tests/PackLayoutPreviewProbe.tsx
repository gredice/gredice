import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
    Box3,
    Color,
    Mesh,
    OrthographicCamera,
    PointLight,
    Vector3,
} from 'three';
import { useSceneRenderRequest } from '../src/scene/SceneTime';
import { useSteamSources } from '../src/scene/SteamSources';
import { useGameState } from '../src/useGameState';

export function PackLayoutPreviewProbe({
    onSample,
}: {
    onSample: (value: string) => void;
}) {
    const render = useSceneRenderRequest();
    const previous = useRef('');
    const { sources } = useSteamSources();
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const active = useGameState(
        (state) =>
            state.packLayoutPreview !== null || state.packLayoutPreviewLocked,
    );
    useEffect(() => {
        scene.userData.layoutPreviewActive = active;
        render(`pack-layout-probe:${active}`);
    }, [scene, active, render]);
    useFrame(() => {
        const preview = scene.getObjectByName('Interaction:PackLayoutPreview');
        let ghosts = 0,
            cells = 0,
            lights = 0,
            opaque = 0,
            hits = 0;
        const origins: number[][] = [];
        const cellHeights: number[] = [];
        const cellColors: string[] = [];
        preview?.traverse((object) => {
            if (object.name.startsWith('PackLayout:Ghost:')) {
                ghosts++;
                origins.push(
                    (object.children[0] ?? object)
                        .getWorldPosition(new Vector3())
                        .toArray(),
                );
            }
            if (object.name === 'PackLayout:Cell' && object instanceof Mesh) {
                cells++;
                cellHeights.push(object.getWorldPosition(new Vector3()).y);
                const material = Array.isArray(object.material)
                    ? object.material[0]
                    : object.material;
                if (
                    material &&
                    'color' in material &&
                    material.color instanceof Color
                )
                    cellColors.push(material.color.getHexString());
            }
            if (object instanceof PointLight) lights++;
            if (object instanceof Mesh) {
                for (const material of Array.isArray(object.material)
                    ? object.material
                    : [object.material])
                    if (!material.transparent || material.opacity > 0.4)
                        opaque++;
                hits += object.userData.interactionTarget ? 1 : 0;
            }
        });
        const ground = new Vector3(3, 0, 3).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        const sample = JSON.stringify({
            camera: {
                position: camera.position.toArray(),
                quaternion: camera.quaternion.toArray(),
                zoom: camera instanceof OrthographicCamera ? camera.zoom : 0,
            },
            projected: preview
                ? (() => {
                      preview.updateWorldMatrix(true, true);
                      const box = new Box3().setFromObject(preview, true);
                      const points: number[][] = [];
                      for (const x of [box.min.x, box.max.x])
                          for (const y of [box.min.y, box.max.y])
                              for (const z of [box.min.z, box.max.z]) {
                                  const point = new Vector3(x, y, z).project(
                                      camera,
                                  );
                                  points.push([
                                      rect.left +
                                          ((point.x + 1) * rect.width) / 2,
                                      rect.top +
                                          ((1 - point.y) * rect.height) / 2,
                                  ]);
                              }
                      return points;
                  })()
                : [],
            exists: Boolean(preview),
            ghosts,
            cells,
            lights,
            opaque,
            hits,
            steam: sources.length,
            rotation: preview?.userData.rotation,
            anchor: preview?.userData.anchor,
            valid: preview?.userData.valid,
            origins,
            cellHeights,
            cellColors,
            active: scene.userData.layoutPreviewActive,
            normalized: { x: (ground.x + 1) / 2, y: (1 - ground.y) / 2 },
            screen: {
                x: rect.left + ((ground.x + 1) * rect.width) / 2,
                y: rect.top + ((1 - ground.y) * rect.height) / 2,
            },
        });
        if (sample !== previous.current) {
            previous.current = sample;
            onSample(sample);
        }
    });
    return null;
}
