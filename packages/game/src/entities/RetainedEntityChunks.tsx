import type { RetainedGardenScene } from '../scene/compiler/retainedGardenScene';
import {
    RetainedEntityChunk,
    type RetainedEntityChunkProps,
} from './RetainedEntityChunk';
import { RetainedEntitySceneContext } from './retainedEntitySceneContext';

export function RetainedEntityChunks({
    scene,
    ...props
}: Omit<RetainedEntityChunkProps, 'chunk'> & { scene: RetainedGardenScene }) {
    return (
        <RetainedEntitySceneContext value={scene.stacks}>
            {scene.chunks.map((chunk) => (
                <RetainedEntityChunk key={chunk.key} chunk={chunk} {...props} />
            ))}
        </RetainedEntitySceneContext>
    );
}
