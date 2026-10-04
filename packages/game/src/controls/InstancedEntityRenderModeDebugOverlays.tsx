import { Edges } from '@react-three/drei';
import { useBlockData } from '../hooks/useBlockData';
import { useGameState } from '../useGameState';
import type { BlockInteractionLayerTarget } from './BlockInteractionResolver';

const instancedRenderModeDebugColor = '#22c55e';

export function InstancedEntityRenderModeDebugOverlays({
    targets,
}: {
    targets: BlockInteractionLayerTarget[];
}) {
    const { data: blockData } = useBlockData();
    const visible = useGameState((state) => state.entityRenderModeDebugVisible);

    if (!visible) {
        return null;
    }

    return targets.map((target) => {
        const blockHeight =
            blockData?.find(
                (entity) => entity.information.name === target.block.name,
            )?.attributes.height ?? 1;
        const overlayHeight = Math.max(blockHeight, 0.35);

        return (
            <mesh
                key={target.key}
                name={`Debug:EntityRenderMode:instanced:${target.block.name}:${target.block.id}`}
                position={[
                    target.stack.position.x,
                    target.stackHeight + overlayHeight / 2,
                    target.stack.position.z,
                ]}
                scale={[1.05, 1.02, 1.05]}
                renderOrder={10_001}
                raycast={() => null}
            >
                <boxGeometry args={[1, overlayHeight, 1]} />
                <meshBasicMaterial visible={false} />
                <Edges
                    color={instancedRenderModeDebugColor}
                    renderOrder={10_001}
                    threshold={1}
                />
            </mesh>
        );
    });
}
