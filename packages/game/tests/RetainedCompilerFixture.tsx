import { Canvas } from '@react-three/fiber';
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { BoxGeometry } from 'three';
import type { ChunkedMeshInstance } from '../src/entities/chunkedMeshGeometry';
import { useRetainedMeshChunks } from '../src/entities/useRetainedMeshChunks';
import { RetainedCompilerChunk } from './RetainedCompilerChunk';

const initial: ChunkedMeshInstance[] = [
    { position: [1, 0, 0], rotation: 0 },
    { position: [10, 0, 0], rotation: 0 },
];

export function RetainedCompilerFixture() {
    const source = useMemo(
        () => new BoxGeometry(0.8, 0.8, 0.8, 16, 16, 16),
        [],
    );
    const [instances, setInstances] = useState(initial);
    const [visible, setVisible] = useState(true);
    const [ids, setIds] = useState<Record<string, string>>({});
    const report = useCallback(
        (key: string, uuid: string) =>
            setIds((ids) => ({ ...ids, [key]: uuid })),
        [],
    );
    const chunks = useRetainedMeshChunks(instances);
    useEffect(
        () => () => {
            source.dispose();
        },
        [source],
    );
    return (
        <>
            <button
                type="button"
                onClick={() =>
                    setInstances((instances) => [
                        {
                            ...instances[0],
                            rotation: instances[0].rotation + 1,
                        },
                        instances[1],
                    ])
                }
            >
                Patch first chunk
            </button>
            <button
                type="button"
                onClick={() => setInstances((instances) => [...instances])}
            >
                Reconcile unchanged
            </button>
            <button
                type="button"
                onClick={() => setVisible((visible) => !visible)}
            >
                Toggle garden
            </button>
            <output data-testid="compiler-ids">{JSON.stringify(ids)}</output>
            <div style={{ width: 600, height: 350 }}>
                <Canvas
                    orthographic
                    camera={{ position: [5, 20, 0], up: [0, 0, -1], zoom: 35 }}
                >
                    <StrictMode>
                        {visible
                            ? chunks.map((chunk) => (
                                  <RetainedCompilerChunk
                                      key={chunk.key}
                                      chunk={chunk}
                                      source={source}
                                      report={report}
                                  />
                              ))
                            : null}
                    </StrictMode>
                </Canvas>
            </div>
        </>
    );
}
