'use client';

import { useMemo } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { getStackHeight } from '../utils/getStackHeight';
import { outletOfferIdFromBlockId } from './outletGardenLayout';
import {
    normalizePublicGardenStacks,
    type PublicGardenDetail,
    publicGardenStacksFromResponse,
} from './PublicGardenViewer';

const seedlingLeafColors = ['#4f8f3a', '#5c9f42', '#3f7f35'] as const;
const ignorePointerRaycast = () => undefined;

export function OutletGardenSeedlingMarkers({
    stacks,
}: {
    stacks: PublicGardenDetail['stacks'];
}) {
    const { data: blockData } = useBlockData();
    const markers = useMemo(() => {
        const normalizedStacks = normalizePublicGardenStacks(
            publicGardenStacksFromResponse(stacks),
        );

        return normalizedStacks.flatMap((stack) =>
            stack.blocks.flatMap((block) => {
                const offerId = outletOfferIdFromBlockId(block.id);
                if (offerId === null) {
                    return [];
                }

                return [
                    {
                        color:
                            seedlingLeafColors[
                                offerId % seedlingLeafColors.length
                            ] ?? seedlingLeafColors[0],
                        id: offerId,
                        position: stack.position
                            .clone()
                            .setY(getStackHeight(blockData, stack)),
                        rotation: ((offerId % 8) * Math.PI) / 4,
                    },
                ];
            }),
        );
    }, [blockData, stacks]);

    return (
        <group name="OutletGardenSeedlingMarkers">
            {markers.map((marker) => (
                <group
                    key={marker.id}
                    position={marker.position}
                    rotation={[0, marker.rotation, 0]}
                >
                    <mesh
                        castShadow
                        position={[0, 0.26, 0]}
                        raycast={ignorePointerRaycast}
                    >
                        <cylinderGeometry args={[0.025, 0.035, 0.52, 6]} />
                        <meshStandardMaterial color="#3d7a32" roughness={0.9} />
                    </mesh>
                    <mesh
                        castShadow
                        position={[0.1, 0.39, 0]}
                        raycast={ignorePointerRaycast}
                        rotation={[0, 0, -0.45]}
                        scale={[1, 0.28, 0.55]}
                    >
                        <sphereGeometry args={[0.15, 8, 6]} />
                        <meshStandardMaterial
                            color={marker.color}
                            roughness={0.86}
                        />
                    </mesh>
                    <mesh
                        castShadow
                        position={[-0.1, 0.51, 0.02]}
                        raycast={ignorePointerRaycast}
                        rotation={[0, 0, 0.45]}
                        scale={[1, 0.28, 0.55]}
                    >
                        <sphereGeometry args={[0.15, 8, 6]} />
                        <meshStandardMaterial
                            color={marker.color}
                            roughness={0.86}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}
