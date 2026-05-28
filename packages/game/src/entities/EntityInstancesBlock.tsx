import { Instance, Instances } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { Material } from 'three';
import type { BufferGeometry } from 'three/src/Three.Core.js';
import { useBlockData } from '../hooks/useBlockData';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { type SnowMaterialOptions, SnowOverlay } from '../snow/SnowOverlay';
import type { Stack } from '../types/Stack';
import { type ActiveDragPreview, useGameState } from '../useGameState';
import { getStackHeight } from '../utils/getStackHeight';

const defaultLocalPosition: [number, number, number] = [0, 0, 0];
const defaultLocalRotation: [number, number, number] = [0, 0, 0];

export type EntityInstancesBlockBaseProps = {
    stacks: Stack[] | undefined;
    name: string;
    renderSnow?: boolean;
    localPosition?: [number, number, number];
    localRotation?: [number, number, number];
    yOffset?: number;
    snowLift?: number;
    snowOverlayMinCoverage?: number;
    scale?: [number, number, number];
    geometry: BufferGeometry;
    snow?: SnowMaterialOptions;
    renderRainWetOverlay?: boolean;
};

export type EntityInstancesBlockMaterialProps =
    | {
          material: Material | Material[];
          materialNode?: never;
      }
    | {
          material?: never;
          materialNode: ReactNode;
      };

function getDragPreviewOffset(
    blockId: string,
    activeDragPreview: ActiveDragPreview | null,
) {
    if (!activeDragPreview) {
        return null;
    }

    if (
        activeDragPreview.sourceBlockId !== blockId &&
        activeDragPreview.attachedBlockId !== blockId
    ) {
        return null;
    }

    return {
        x: activeDragPreview.relative.x,
        y: activeDragPreview.attachedHoverHeight + 0.1,
        z: activeDragPreview.relative.z,
    };
}

export function EntityInstancesBlock(
    props: EntityInstancesBlockBaseProps & EntityInstancesBlockMaterialProps,
) {
    const {
        stacks,
        name,
        renderSnow = true,
        localPosition,
        localRotation,
        yOffset,
        snowLift = 0,
        snowOverlayMinCoverage,
        scale,
        geometry,
        snow,
        renderRainWetOverlay = false,
    } = props;
    const { data: blockData } = useBlockData();
    const activeDragPreview = useGameState((state) => state.activeDragPreview);

    const blockInstances = stacks
        ?.filter((stack) => stack.blocks.some((b) => b.name === name))
        .flatMap((stack) =>
            stack.blocks
                ?.filter((block) => block.name === name)
                .map((block) => {
                    const y = getStackHeight(blockData, stack, block);
                    const dragPreviewOffset = getDragPreviewOffset(
                        block.id,
                        activeDragPreview,
                    );
                    return {
                        id: block.id,
                        position: [
                            stack.position.x + (dragPreviewOffset?.x ?? 0),
                            y + (yOffset ?? 0) + (dragPreviewOffset?.y ?? 0),
                            stack.position.z + (dragPreviewOffset?.z ?? 0),
                        ] as const,
                        rotation: block.rotation || 0,
                    };
                }),
        );

    const limit = Math.max((blockInstances?.length ?? 0) + 10, 100);

    const localTransform = {
        position: localPosition ?? defaultLocalPosition,
        rotation: localRotation ?? defaultLocalRotation,
    };

    const renderInstances = (suffix: string) =>
        (blockInstances ?? []).map((data) => (
            <group
                key={`block-${name}-${suffix}-${data.id}`}
                position={data.position}
                rotation={[0, data.rotation * (Math.PI / 2), 0]}
            >
                <Instance
                    position={localTransform.position}
                    rotation={localTransform.rotation}
                    scale={scale}
                />
            </group>
        ));

    const renderSnowOverlays = () =>
        !snow || !renderSnow
            ? null
            : (blockInstances ?? []).map((data) => (
                  <group
                      key={`block-${name}-snow-${data.id}`}
                      position={[
                          data.position[0],
                          data.position[1] + (snowLift || 0.003),
                          data.position[2],
                      ]}
                      rotation={[0, data.rotation * (Math.PI / 2), 0]}
                  >
                      <group
                          position={localTransform.position}
                          rotation={localTransform.rotation}
                          scale={scale}
                      >
                          <SnowOverlay
                              geometry={geometry}
                              minCoverage={snowOverlayMinCoverage}
                              {...snow}
                          />
                      </group>
                  </group>
              ));

    const renderRainOverlays = () =>
        !renderRainWetOverlay
            ? null
            : (blockInstances ?? []).map((data) => (
                  <group
                      key={`block-${name}-rain-${data.id}`}
                      position={data.position}
                      rotation={[0, data.rotation * (Math.PI / 2), 0]}
                  >
                      <group
                          position={localTransform.position}
                          rotation={localTransform.rotation}
                          scale={scale}
                      >
                          <RainWetOverlay geometry={geometry} />
                      </group>
                  </group>
              ));

    return (
        <>
            <Instances
                limit={limit}
                geometry={geometry}
                receiveShadow
                castShadow
                material={'material' in props ? props.material : undefined}
            >
                {'materialNode' in props ? props.materialNode : null}
                {renderInstances('base')}
            </Instances>
            {renderRainOverlays()}
            {renderSnowOverlays()}
        </>
    );
}
