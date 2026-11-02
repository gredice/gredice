import { Canvas, useFrame } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { InstancedMesh, Matrix4 } from 'three';
import {
    ActorGroundingShadowProvider,
    useActorGroundingShadow,
} from '../src/entities/animals/ActorGroundingShadows';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';

type Receipt = {
    stage: number;
    instances: number;
    calls: number;
    triangles: number;
    firstX: number;
    species: Record<string, number>;
    updates: number;
};

export function ActorShadowMembershipFixture({
    stage = 0,
}: {
    stage?: number;
}) {
    const [receipt, setReceipt] = useState<Receipt>();
    const report = useCallback((value: Receipt) => setReceipt(value), []);
    return (
        <div
            data-testid="shadow-membership"
            data-ready={receipt?.stage === stage ? String(stage) : ''}
            data-result={JSON.stringify(receipt)}
            style={{ width: 320, height: 240 }}
        >
            <Canvas frameloop="always" camera={{ position: [0, 4, 4] }}>
                <ActorGroundingShadowProvider enabled>
                    <Actor species="cow" x={Math.min(stage, 2)} />
                    {stage !== 0 && stage !== 4 && (
                        <Actor species="goat" x={3} />
                    )}
                    <SubmittedMembership stage={stage} report={report} />
                </ActorGroundingShadowProvider>
            </Canvas>
        </div>
    );
}

function Actor({ species, x }: { species: 'cow' | 'goat'; x: number }) {
    const update = useActorGroundingShadow({
        id: species,
        species,
        primaryCasterCount: 0,
    });
    useLayoutEffect(() => {
        update?.({ actorY: 0, receiverY: 0, visible: true, x, yaw: 0, z: 0 });
    }, [update, x]);
    return null;
}

function SubmittedMembership({
    stage,
    report,
}: {
    stage: number;
    report: (receipt: Receipt) => void;
}) {
    const lastStage = useRef(-1);
    // This isolated semantic fixture holds the reporting clock inside its
    // 250 ms interval. Canonical profiling clocks and windows are untouched.
    const time = [0.1, 0.15, 0.2, 0.45, 0.46, 0.47][stage];
    useFrame(({ clock }) => {
        clock.elapsedTime = time;
    }, -100);
    useFrame(({ gl, scene, camera }) => {
        gl.render(scene, camera);
        if (lastStage.current === stage) return;
        const mesh = scene.getObjectByName('ActorGroundingShadows');
        if (!(mesh instanceof InstancedMesh)) return;
        const expected = stage === 0 || stage === 4 ? 1 : 2;
        if (mesh.count !== expected) return;
        const metadata = readGameProfileMetadata();
        const matrix = new Matrix4();
        mesh.getMatrixAt(0, matrix);
        lastStage.current = stage;
        report({
            stage,
            instances: mesh.count,
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
            firstX: matrix.elements[12],
            species: metadata?.actorGroundingShadowSpeciesCounts ?? {},
            updates: metadata?.actorGroundingShadowUpdateCount ?? -1,
        });
    }, 1);
    return null;
}
