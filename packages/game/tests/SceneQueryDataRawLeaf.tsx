import { useBlockData } from '../src/hooks/useBlockData';
import { SceneBlockDataProvider } from '../src/scene/SceneBlockDataProvider';
import { SceneQueryDataLeaf } from './SceneQueryDataLeaf';

// Reference fanout uses the unchanged public hook, one real observer per leaf.
export function SceneQueryDataRawLeaf({ index }: { index: number }) {
    const { data } = useBlockData();
    return (
        <SceneBlockDataProvider data={data}>
            <SceneQueryDataLeaf index={index} />
        </SceneBlockDataProvider>
    );
}
