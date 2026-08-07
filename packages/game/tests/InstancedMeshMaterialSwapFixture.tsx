'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    BoxGeometry,
    InstancedMesh,
    Matrix4,
    MeshBasicMaterial,
    Vector3,
} from 'three';
import type { MeshInstanceLocalTransform } from '../src/entities/chunkedMeshGeometry';
import {
    ChunkedInstancedMesh,
    type EntityBlockInstance,
} from '../src/entities/EntityInstancesBlock';

const firstBlock = {
    id: 'material-swap-first',
    name: 'Material_Swap_First',
    rotation: 0,
};
const secondBlock = {
    id: 'material-swap-second',
    name: 'Material_Swap_Second',
    rotation: 0,
};
const firstStack = {
    blocks: [firstBlock],
    position: new Vector3(2, 1, 3),
};
const secondStack = {
    blocks: [secondBlock],
    position: new Vector3(4, 2, 5),
};
const instances = [
    {
        block: firstBlock,
        blockIndex: 0,
        id: firstBlock.id,
        pickupOutlineVisible: false,
        position: [2, 1, 3],
        rotation: 0,
        stack: firstStack,
        stackHeight: 1,
    },
    {
        block: secondBlock,
        blockIndex: 0,
        id: secondBlock.id,
        pickupOutlineVisible: false,
        position: [4, 2, 5],
        rotation: 0,
        stack: secondStack,
        stackHeight: 1,
    },
] satisfies EntityBlockInstance[];
const chunk = { instances, key: 'material-swap' };
const localTransform: MeshInstanceLocalTransform = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
};

type MatrixReadback = {
    positions: number[][];
    status: 'ready';
};

function roundPosition(position: Vector3) {
    return position.toArray().map((value) => Number(value.toFixed(4)));
}

function MaterialSwapScene({
    onReadback,
}: {
    onReadback: (readback: MatrixReadback) => void;
}) {
    const scene = useThree((state) => state.scene);
    const [swapped, setSwapped] = useState(false);
    const renderedFrameCount = useRef(0);
    const postSwapFrameCount = useRef(0);
    const swapRequested = useRef(false);
    const readbackComplete = useRef(false);
    const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
    const initialMaterial = useMemo(
        () => new MeshBasicMaterial({ color: '#8b5a2b' }),
        [],
    );
    const replacementMaterial = useMemo(
        () => new MeshBasicMaterial({ color: '#4f321c' }),
        [],
    );

    useEffect(
        () => () => {
            geometry.dispose();
            initialMaterial.dispose();
            replacementMaterial.dispose();
        },
        [geometry, initialMaterial, replacementMaterial],
    );

    useFrame(() => {
        renderedFrameCount.current += 1;
        if (
            !swapped &&
            !swapRequested.current &&
            renderedFrameCount.current >= 2
        ) {
            swapRequested.current = true;
            setSwapped(true);
            return;
        }

        if (!swapped || readbackComplete.current) {
            return;
        }

        postSwapFrameCount.current += 1;
        if (postSwapFrameCount.current < 3) {
            return;
        }

        const object = scene.getObjectByName('MaterialSwapInstances');
        if (!(object instanceof InstancedMesh)) {
            return;
        }

        const matrix = new Matrix4();
        const position = new Vector3();
        const positions = instances.map((_, index) => {
            object.getMatrixAt(index, matrix);
            position.setFromMatrixPosition(matrix);
            return roundPosition(position);
        });
        readbackComplete.current = true;
        onReadback({ positions, status: 'ready' });
    });

    return (
        <ChunkedInstancedMesh
            castShadow={false}
            chunk={chunk}
            debugName="MaterialSwapInstances"
            geometry={geometry}
            localTransform={localTransform}
            material={swapped ? replacementMaterial : initialMaterial}
            materialNode={null}
            placementSignature="material-swap-placement"
            receiveShadow={false}
            scale={undefined}
        />
    );
}

export function InstancedMeshMaterialSwapFixture() {
    const [result, setResult] = useState<
        MatrixReadback | { status: 'waiting' }
    >({ status: 'waiting' });
    const handleReadback = useCallback(
        (readback: MatrixReadback) => setResult(readback),
        [],
    );

    return (
        <div
            data-render-ready={result.status === 'ready' ? 'true' : 'false'}
            data-testid="instanced-mesh-material-swap-fixture"
            style={{ height: 240, width: 360 }}
        >
            <output data-testid="instanced-mesh-material-swap-result">
                {JSON.stringify(result)}
            </output>
            <Canvas
                camera={{ position: [0, 0, 10] }}
                frameloop="always"
                gl={{ preserveDrawingBuffer: true }}
            >
                <MaterialSwapScene onReadback={handleReadback} />
            </Canvas>
        </div>
    );
}
