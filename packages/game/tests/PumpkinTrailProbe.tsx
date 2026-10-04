import { pumpkinTrailStops } from '@gredice/js/pumpkinTrail';
import { useThree } from '@react-three/fiber';
import { useRef } from 'react';
import {
    Box3,
    Mesh,
    MeshStandardMaterial,
    OrthographicCamera,
    PointLight,
    Vector3,
} from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
export function PumpkinTrailProbe({
    onReport,
}: {
    onReport: (report: string) => void;
}) {
    const { scene, camera, size, gl } = useThree();
    const previous = useRef('');
    useSceneTimeInvalidation('test:pumpkin-trail', true);
    useSceneAfterFrame(() => {
        scene.updateMatrixWorld(true);
        const lanterns = pumpkinTrailStops.flatMap((stop) => {
            const root = scene.getObjectByName(`PumpkinLantern:${stop.id}`);
            if (!root) return [];
            let emissive = 0;
            let light = 0;
            root.traverse((object) => {
                if (
                    object instanceof Mesh &&
                    object.name.endsWith('_Glow') &&
                    object.material instanceof MeshStandardMaterial
                )
                    emissive = object.material.emissiveIntensity;
                if (object instanceof PointLight && object.visible) light += 1;
            });
            const center = new Box3()
                .setFromObject(root)
                .getCenter(new Vector3())
                .project(camera);
            return [
                {
                    id: stop.id,
                    emissive,
                    light,
                    screen: {
                        x: ((center.x + 1) * size.width) / 2,
                        y: ((1 - center.y) * size.height) / 2,
                    },
                },
            ];
        });
        const entities = scene.getObjectByName('PublicGardenScene:Entities');
        if (lanterns.length !== 5 || !entities) return;
        const bounds = new Box3().setFromObject(entities);
        if (bounds.isEmpty()) return;
        const points: Vector3[] = [];
        for (const x of [bounds.min.x, bounds.max.x])
            for (const y of [bounds.min.y, bounds.max.y])
                for (const z of [bounds.min.z, bounds.max.z])
                    points.push(new Vector3(x, y, z).project(camera));
        const context = gl.getContext();
        const pixels = new Uint8Array(32 * 32 * 4);
        context.readPixels(
            Math.floor(context.drawingBufferWidth / 2) - 16,
            Math.floor(context.drawingBufferHeight / 2) - 16,
            32,
            32,
            context.RGBA,
            context.UNSIGNED_BYTE,
            pixels,
        );
        const colors = new Set<string>();
        for (let i = 0; i < pixels.length; i += 4)
            colors.add(`${pixels[i]}:${pixels[i + 1]}:${pixels[i + 2]}`);
        const report = JSON.stringify({
            lanterns,
            camera: {
                position: camera.position.toArray(),
                rotation: camera.quaternion.toArray(),
                zoom: camera instanceof OrthographicCamera ? camera.zoom : null,
            },
            pixels: colors.size,
            width: size.width,
            height: size.height,
            markers: pumpkinTrailStops.filter((stop) =>
                scene.getObjectByName(`PumpkinTrailMarker:${stop.id}`),
            ).length,
            bounds: {
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
        });
        if (previous.current !== report) {
            previous.current = report;
            onReport(report);
        }
    });
    return null;
}
