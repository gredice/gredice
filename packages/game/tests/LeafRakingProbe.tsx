import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
export function LeafRakingProbe({
    onSample,
}: {
    onSample: (sample: string) => void;
}) {
    const previous = useRef('');
    const rendered = useRef({
        key: 0,
        peak: 0,
        minProgress: 1,
        maxProgress: 0,
        frames: 0,
    });
    useFrame(({ scene, camera, gl }) => {
        const group = scene.getObjectByName('CosmeticLeafRaking:Effect');
        const leaves = scene.getObjectByName('CosmeticLeafRaking:Leaves');
        const anchor = scene.getObjectByName('LeafRake:rake-anchor:rake');
        const matrix = new Matrix4();
        const pose = new Vector3();
        if (leaves instanceof InstancedMesh && leaves.count > 0) {
            leaves.getMatrixAt(0, matrix);
            pose.setFromMatrixPosition(matrix);
        }
        const key = group?.userData.startedAtMs ?? 0;
        if (key !== rendered.current.key) {
            rendered.current = {
                key,
                peak: 0,
                minProgress: 1,
                maxProgress: 0,
                frames: 0,
            };
        }
        if (
            group?.visible &&
            leaves instanceof InstancedMesh &&
            leaves.count > 0
        ) {
            rendered.current.peak = Math.max(
                rendered.current.peak,
                leaves.count,
            );
            rendered.current.minProgress = Math.min(
                rendered.current.minProgress,
                group.userData.progress ?? 0,
            );
            rendered.current.maxProgress = Math.max(
                rendered.current.maxProgress,
                group.userData.progress ?? 0,
            );
            rendered.current.frames++;
        }
        const projected = anchor
            ?.getWorldPosition(new Vector3())
            .project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        const report = JSON.stringify({
            ready: Boolean(anchor),
            rendered: rendered.current,
            visible: Boolean(group?.visible),
            progress: group?.userData.progress ?? 0,
            count: leaves instanceof InstancedMesh ? leaves.count : 0,
            pose: pose.toArray(),
            reduced: group?.userData.reducedMotion ?? false,
            origin: group?.position.toArray(),
            anchor: anchor?.getWorldPosition(new Vector3()).toArray(),
            screen: projected
                ? {
                      x: rect.left + ((projected.x + 1) * rect.width) / 2,
                      y: rect.top + ((1 - projected.y) * rect.height) / 2,
                  }
                : null,
        });
        if (previous.current !== report) {
            previous.current = report;
            onSample(report);
        }
    });
    return null;
}
