import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import {
    Box3,
    Color,
    InstancedMesh,
    Mesh,
    MeshStandardMaterial,
    ShaderMaterial,
    Vector3,
} from 'three';
import { useAutumnSources } from '../src/scene/AutumnSources';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';
import { useGameState } from '../src/useGameState';
import { useGameGLTF } from '../src/utils/useGameGLTF';
import type { AutumnShrubReviewCase } from './autumnShrubReviewCases';

export function SeasonalMapleProbe({
    ready,
    onReady,
    scenario,
    date,
}: {
    ready: boolean;
    onReady: (data: string) => void;
    scenario: AutumnShrubReviewCase;
    date: Date;
}) {
    const { scene, camera, size, gl } = useThree();
    const sources = useAutumnSources();
    const { materials, nodes } = useGameGLTF('SeasonalMaple');
    const bush = useGameGLTF('Bush');
    const clock = useGameState((state) => state.freezeTime);
    const snowCoverage = useGameState((state) => state.snowCoverage);
    useSceneTimeInvalidation('test:shrub-ready', !ready);
    useLayoutEffect(() => {
        camera.lookAt(-0.4, 0.65, -0.4);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        if (ready || clock?.getTime() !== date.getTime()) return;
        scene.updateMatrixWorld(true);
        const shrubs = ['shrub-ground', 'shrub-table', 'shrub-disabled'].map(
            (id) => {
                const root = scene.getObjectByName(`SeasonalMaple:${id}`);
                if (!root) throw new Error(`Missing shrub ${id}`);
                const bounds = new Box3().setFromObject(root);
                const point = root
                    .localToWorld(new Vector3(0, 0.12, 0))
                    .project(camera);
                const foliage: {
                    name: string;
                    color: string;
                    colors: number[];
                    firstColor: string;
                    triangles: number;
                    materialId: string;
                }[] = [];
                let snow = 0;
                let rain = 0;
                root.traverse((node) => {
                    if (node.name === 'SnowOverlay') snow++;
                    if (
                        node instanceof Mesh &&
                        node.material instanceof ShaderMaterial &&
                        'uWetness' in node.material.uniforms
                    )
                        rain++;
                    if (
                        node instanceof Mesh &&
                        node.material instanceof MeshStandardMaterial &&
                        node.name !== 'SeasonalMaple_Wood'
                    ) {
                        foliage.push({
                            name: node.name,
                            color: `#${node.material.color.getHexString()}`,
                            firstColor: new Color().fromBufferAttribute(node.geometry.getAttribute('color'),0).getHexString(),
                            colors: Array.from(
                                node.geometry.getAttribute('color').array,
                            ),
                            triangles:
                                (node.geometry.index?.count ??
                                    node.geometry.getAttribute('position')
                                        .count) / 3,
                            materialId: node.material.uuid,
                        });
                    }
                });
                return {
                    id,
                    stage: root.userData.canopyStage,
                    foliage,
                    snow,
                    rain,
                    rotation: root.rotation.y,
                    minY: bounds.min.y,
                    height: bounds.max.y - bounds.min.y,
                    width: bounds.max.x - bounds.min.x,
                    depth: bounds.max.z - bounds.min.z,
                    x: ((point.x + 1) * size.width) / 2,
                    y: ((1 - point.y) * size.height) / 2,
                };
            },
        );
        if (scenario === 'snow' && shrubs[0].snow === 0) return;
        if (scenario === 'rain' && shrubs[0].rain === 0) return;
        if (scenario === 'disabled' && snowCoverage !== 0) return;
        const legacyBushColors: string[] = [];
        scene.getObjectByName('review:legacy-bush')?.traverse((node) => {
            if (
                node instanceof Mesh &&
                node.material instanceof MeshStandardMaterial
            )
                legacyBushColors.push(node.material.color.getHexString());
        });
        onReady(
            JSON.stringify({
                shrubs,
                sources: sources.length,
                draws: gl.info.render.calls,
                triangles: gl.info.render.triangles,
                leaves: (() => {
                    let count = 0;
                    scene.traverse((node) => {
                        if (
                            node instanceof InstancedMesh &&
                            node.name.includes('Weather:AutumnLeaves')
                        )
                            count += node.count;
                    });
                    return count;
                })(),
                date: clock.toISOString(),
                legacyBushColors,
                cached: {
                    gold: materials[
                        'Material.SeasonalMaple.Leaves'
                    ].color.getHexString(),
                    goldHasVertexColors: Boolean(
                        nodes.SeasonalMaple_Full.geometry.getAttribute('color'),
                    ),
                    bush: bush.materials[
                        'Material.ColorPaletteMain'
                    ].color.getHexString(),
                },
            }),
        );
    });
    return null;
}
