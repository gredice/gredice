import { memo, useLayoutEffect } from 'react';
import type { BufferGeometry } from 'three';
import type {
    ChunkedMeshInstance,
    MeshInstanceChunk,
} from '../src/entities/chunkedMeshGeometry';
import { useCompiledChunk } from '../src/scene/compiler/useCompiledChunk';

const transform = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
} satisfies Parameters<typeof useCompiledChunk>[2];

export const RetainedCompilerChunk = memo(function RetainedCompilerChunk({
    chunk,
    source,
    report,
}: {
    chunk: MeshInstanceChunk<ChunkedMeshInstance>;
    source: BufferGeometry;
    report: (key: string, uuid: string) => void;
}) {
    const build = useCompiledChunk(source, chunk.instances, transform, 1);
    useLayoutEffect(() => {
        if (build) report(chunk.key, build.geometry.uuid);
    }, [build, chunk.key, report]);
    return build ? (
        <mesh geometry={build.geometry}>
            <meshBasicMaterial color="#78bb58" />
        </mesh>
    ) : null;
});
